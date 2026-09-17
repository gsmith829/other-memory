#!/usr/bin/env python3
"""Every publishable page under content/ was emitted -- and nothing else was. journey-site#5, #34.

    check-emitted.py <content-dir> <output-dir> [--config site/quartz/quartz.config.yaml]
    check-emitted.py --selftest

Run by .forgejo/workflows/build.yml after site/quartz/build.sh. Stdlib only (no pip on bijaz).

Two assertions, both of which a blind `find content -name '*.md'` gets wrong (skippy's review
of #33 -- it would fail the build the first time a draft is staged, which is the normal way
a post is curated):
  1. every markdown file Quartz WOULD publish has its .html in the output; a page Quartz
     intentionally skips -- `draft: true` in frontmatter (the remove-draft plugin) or a path
     under one of the config's `ignorePatterns` -- is not expected;
  2. the inverse, which matters more for this site: a draft or ignored page must NOT appear
     in the output. "It was excluded" is a claim about the build; this is the measurement.
Plus the feed, the sitemap and the Pages `_headers` file exist and are non-empty.

Third (journey-site#20, #21): the AI-authorship disclosure reached every surface a reader meets
before the footer. The site/quartz/plugins/disclosure plugin appends it at build time; this is
the measurement that it did -- and it is needed because Quartz's loader SKIPS a plugin whose
factory fails and still exits 0, so "the build was green" says nothing about it. Read from the
config's plugin entry (`disclosure`, `lead`, `colophonSlug`) -- a config without that entry
FAILS, this site does not publish without it:
  3. every published page's og:description and <meta name="description"> END with the full
     `disclosure` (the page's own summary leads); every page's og:image names a card file that
     exists (the card carries the disclosure as its own line -- an image, so its text is
     checked by eye on the PR, its presence here); every page but the colophon carries the
     byline, the colophon does not (it is the link's target) and it exists; every feed item's
     description contains the full `disclosure`.
"""
import html as html_mod
import argparse
import os
import re
import shutil
import sys
import tempfile

FRONTMATTER = re.compile(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", re.S)
DRAFT = re.compile(r"^draft:\s*(true|yes)\s*$", re.M | re.I)
REQUIRED = ("index.html", "index.xml", "sitemap.xml", "_headers")


def ignore_patterns(config_path):
    """The `ignorePatterns:` list under `configuration:` -- plain path prefixes, as upstream's
    default config uses them. A glob with metacharacters is not something this reads; it is
    reported and treated as a prefix, which fails safe (the page is then EXPECTED, not skipped)."""
    pats = []
    if not config_path or not os.path.isfile(config_path):
        return pats
    in_block = False
    for line in open(config_path, encoding="utf-8"):
        if re.match(r"^\s{2}ignorePatterns:\s*$", line):
            in_block = True
            continue
        if in_block:
            m = re.match(r"^\s{4}-\s*(\S+)\s*$", line)
            if m:
                pats.append(m.group(1).strip("'\""))
                continue
            break
    return pats


def is_draft(md_path):
    with open(md_path, encoding="utf-8", errors="replace") as f:
        head = f.read(8192)
    m = FRONTMATTER.match(head)
    return bool(m and DRAFT.search(m.group(1)))


def is_ignored(rel, pats):
    parts = rel.split("/")
    return any(p in pats for p in parts[:-1]) or any(rel == p or rel.startswith(p + "/") for p in pats)


def html_for(rel):
    """content/x/y.md -> x/y.html ; content/x/index.md -> x/index.html (Quartz clean URLs)."""
    return rel[:-3] + ".html"


DISCLOSURE_SOURCE = "./site-plugins/disclosure"
OG_DESC = re.compile(r'<meta property="og:description" content="([^"]*)"')
META_DESC = re.compile(r'<meta name="description" content="([^"]*)"')
OG_IMAGE = re.compile(r'<meta property="og:image" content="([^"]*)"')
BYLINE = 'class="disclosure-byline"'
FEED_ITEM = re.compile(r"<item>(.*?)</item>", re.S)
ITEM_DESC = re.compile(r"<description><!\[CDATA\[(.*?)\]\]></description>", re.S)


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


def disclosure_config(config_path):
    """{disclosure, lead, colophonSlug} from the plugin's `options:` block in the config, or None
    when the entry is absent or not enabled. Same hand parser style as ignore_patterns(): the
    values are single-line YAML scalars, double-quoted or bare; anything fancier is not read."""
    if not config_path or not os.path.isfile(config_path):
        return None
    lines = open(config_path, encoding="utf-8").read().splitlines()
    start = next((i for i, l in enumerate(lines) if re.match(r"^\s{2}-\s+source:\s*" + re.escape(DISCLOSURE_SOURCE) + r"\s*(#.*)?$", l)), None)
    if start is None:
        return None
    entry, enabled = {"colophonSlug": "colophon"}, False
    for l in lines[start + 1:]:
        if re.match(r"^\s{2}-\s", l) or re.match(r"^\S", l):
            break
        m = re.match(r"^\s{4}enabled:\s*(\S+)", l)
        if m:
            enabled = m.group(1).lower() == "true"
        m = re.match(r'^\s{6}(disclosure|lead|colophonSlug):\s*(?:"((?:[^"\\]|\\.)*)"|(\S.*?))\s*(?:#.*)?$', l)
        if m:
            entry[m.group(1)] = (m.group(2).replace('\\"', '"') if m.group(2) is not None else m.group(3)).strip()
    if not enabled or "disclosure" not in entry or "lead" not in entry:
        return None
    return entry


def check_disclosure(out, expected, dc, say):
    """The three assertions in the docstring; returns the problem count. `expected` is the
    published-page list run() derived, so this measures exactly the pages that must carry it."""
    fails = 0
    disclosure = norm(dc["disclosure"])
    colophon = dc["colophonSlug"] + ".html"
    if not os.path.isfile(os.path.join(out, colophon)):
        say(f"MISSING: {colophon} -- the byline links to it")
        fails += 1
    for rel in expected:
        h = html_for(rel)
        target = os.path.join(out, h)
        if not os.path.isfile(target):
            continue  # already reported as MISSING above
        page = open(target, encoding="utf-8", errors="replace").read()
        for label, rx in (("og:description", OG_DESC), ("meta description", META_DESC)):
            m = rx.search(page)
            got = norm(html_mod.unescape(m.group(1))) if m else ""
            if not got.endswith(disclosure):
                say(f"NO DISCLOSURE: {h} {label} does not end with the disclosure (...{got[-60:]!r})")
                fails += 1
        m = OG_IMAGE.search(page)
        card = html_mod.unescape(m.group(1)).rsplit("/", 1)[-1] if m else ""
        card_path = os.path.join(out, os.path.dirname(h), card) if card else ""
        if not card.endswith("-og-image.webp") or not os.path.isfile(card_path) or os.path.getsize(card_path) == 0:
            say(f"NO CARD: {h} og:image is {card or '<absent>'!r}, expected a generated card beside the page")
            fails += 1
        has_byline = BYLINE in page
        if h == colophon and has_byline:
            say(f"BYLINE ON COLOPHON: {h} carries the byline that links to itself")
            fails += 1
        elif h != colophon and not has_byline:
            say(f"NO BYLINE: {h}")
            fails += 1
    feed = os.path.join(out, "index.xml")
    items = FEED_ITEM.findall(open(feed, encoding="utf-8", errors="replace").read()) if os.path.isfile(feed) else []
    if expected and not items:
        say("NO DISCLOSURE: index.xml has no items to carry it")
        fails += 1
    for it in items:
        m = ITEM_DESC.search(it)
        title = re.search(r"<title>(.*?)</title>", it, re.S)
        if not m or disclosure not in norm(html_mod.unescape(m.group(1))):
            say(f"NO DISCLOSURE: feed item {title.group(1) if title else '?'!r} description lacks it")
            fails += 1
    return fails


def run(content, out, config, quiet=False):
    say = (lambda *a: None) if quiet else print
    pats = ignore_patterns(config)
    say(f"ignorePatterns from config: {pats or '(none)'}")
    expected, excluded = [], []
    for dirpath, _, names in os.walk(content):
        for n in sorted(names):
            if not n.endswith(".md"):
                continue
            rel = os.path.relpath(os.path.join(dirpath, n), content).replace(os.sep, "/")
            if is_ignored(rel, pats):
                excluded.append((rel, "ignorePatterns"))
            elif is_draft(os.path.join(dirpath, n)):
                excluded.append((rel, "draft: true"))
            else:
                expected.append(rel)
    fails = 0
    for rel in expected:
        target = os.path.join(out, html_for(rel))
        if not os.path.isfile(target) or os.path.getsize(target) == 0:
            say(f"MISSING: {rel} -> {html_for(rel)}")
            fails += 1
    for rel, why in excluded:
        target = os.path.join(out, html_for(rel))
        if os.path.exists(target):
            say(f"LEAKED: {rel} is excluded ({why}) but {html_for(rel)} was emitted")
            fails += 1
    for name in REQUIRED:
        p = os.path.join(out, name)
        if not os.path.isfile(p) or os.path.getsize(p) == 0:
            say(f"MISSING: {name}")
            fails += 1
    dc = disclosure_config(config)
    if dc is None:
        say(f"MISSING: no enabled `{DISCLOSURE_SOURCE}` plugin entry with `disclosure` + `lead` in the config -- "
            "this site does not publish without the disclosure (journey-site#20)")
        fails += 1
    else:
        fails += check_disclosure(out, expected, dc, say)
    say(f"content pages: {len(expected)} expected, {len(excluded)} excluded on purpose, "
        f"{fails} problem(s)")
    return 1 if fails else 0


def selftest():
    fails = 0

    def ok(cond, msg):
        nonlocal fails
        if not cond:
            print("  FAIL", msg)
            fails += 1

    tmp = tempfile.mkdtemp(prefix="check-emitted-selftest-")
    try:
        content, out = os.path.join(tmp, "content"), os.path.join(tmp, "public")
        os.makedirs(os.path.join(content, "garden"))
        os.makedirs(os.path.join(content, "private"))
        os.makedirs(os.path.join(out, "garden"))
        cfg = os.path.join(tmp, "quartz.config.yaml")
        # The plugin block is the real config's shape: quoted scalars, a trailing comment, the
        # entry followed by another `- source:` so the parser's end-of-entry rule is exercised.
        LEAD = "This is a real homelab owned by a human called Joe."
        FULL = LEAD + " The byline \u2014 Nagatha \u2014 is an AI persona, not a person."
        PLUGIN = ("  - source: ./site-plugins/disclosure\n    enabled: true\n    options:\n"
                  f'      disclosure: "{FULL}"\n      lead: "{LEAD}"\n      colophonSlug: colophon\n'
                  "      role: an AI chronicler\n    order: 75 # after description\n"
                  "  - source: \"@quartz-community/footer\"\n    enabled: true\n")
        with open(cfg, "w") as f:
            f.write("configuration:\n  baseUrl: x\n  ignorePatterns:\n    - private\n    - templates\n  theme:\n    x: y\nplugins:\n" + PLUGIN)
        ok(ignore_patterns(cfg) == ["private", "templates"], "ignorePatterns parsed from the config block")
        dc = disclosure_config(cfg)
        ok(dc == {"disclosure": FULL, "lead": LEAD, "colophonSlug": "colophon"}, f"disclosure options parsed from the plugin entry: {dc}")

        def md(rel, fm=""):
            with open(os.path.join(content, rel), "w") as f:
                f.write(f"---\ntitle: t\n{fm}---\nbody\n")

        # Page and feed fixtures are the shapes upstream Quartz emitted at the pin (2026-09-16):
        # preact renders the meta content with &quot;-style escaping, the byline is one <p>, the
        # feed description is CDATA with the page's own text first.
        def html(rel, desc="own text \u2014 " + FULL, byline=True, card=True):
            esc = html_mod.escape(desc, quote=True)
            stem = rel[:-5]
            if card:
                with open(os.path.join(out, stem + "-og-image.webp"), "wb") as f:
                    f.write(b"RIFF....WEBP")
            with open(os.path.join(out, rel), "w") as f:
                f.write(f'<html><head><meta property="og:description" content="{esc}"/><meta name="description" content="{esc}"/>'
                        f'<meta property="og:image" content="https://x/{stem}-og-image.webp"/></head><body>'
                        + ('<p class="disclosure-byline"><span class="disclosure-byline-author">Nagatha</span> \u2014 an AI chronicler; <a href="./colophon" class="internal">what that means</a></p>' if byline else "")
                        + "x</body></html>")

        def feed(items):
            with open(os.path.join(out, "index.xml"), "w") as f:
                f.write("<rss><channel>" + "".join(f"<item>\n    <title>{t}</title>\n    <description><![CDATA[ {d} ]]></description>\n  </item>" for t, d in items) + "</channel></rss>")

        def plain(rel):
            with open(os.path.join(out, rel), "w") as f:
                f.write("x")

        md("index.md"); md("garden/a.md"); md("colophon.md"); md("garden/wip.md", "draft: true\n"); md("private/secret.md")
        html("index.html"); html("garden/a.html"); html("colophon.html", byline=False)
        feed([("t", "own text \u2014 " + FULL), ("a", "own \u2014 " + FULL)])
        for name in REQUIRED[2:]:
            plain(name)
        ok(run(content, out, cfg, quiet=True) == 0, "published pages present, draft + ignored absent, disclosure everywhere -> pass")
        ok(is_draft(os.path.join(content, "garden", "wip.md")) and not is_draft(os.path.join(content, "garden", "a.md")),
           "draft detection reads frontmatter only")
        # Negative 1: a published page missing from the output.
        os.remove(os.path.join(out, "garden", "a.html"))
        ok(run(content, out, cfg, quiet=True) == 1, "missing published page fails")
        html("garden/a.html")
        # Negative 2: a draft that LEAKED into the output.
        html("garden/wip.html")
        ok(run(content, out, cfg, quiet=True) == 1, "emitted draft fails (leak)")
        os.remove(os.path.join(out, "garden", "wip.html"))
        # Negative 3: an ignored path that leaked.
        os.makedirs(os.path.join(out, "private"))
        html("private/secret.html")
        ok(run(content, out, cfg, quiet=True) == 1, "emitted ignored page fails (leak)")
        shutil.rmtree(os.path.join(out, "private"))
        # Negative 4: feed missing.
        os.remove(os.path.join(out, "index.xml"))
        ok(run(content, out, cfg, quiet=True) == 1, "missing feed fails")
        feed([("t", "own \u2014 " + FULL), ("a", "own \u2014 " + FULL)])
        # Draft spelled with a quoted value or capitals still counts.
        md("garden/wip2.md", "Draft: YES\n")
        ok(run(content, out, cfg, quiet=True) == 0, "draft: YES (any case) is a draft")
        ok(run(content, out, cfg, quiet=True) == 0, "still passes with the extra draft absent from output")
        # Disclosure negatives (journey-site#20/#21) -- each is the exact silent failure it guards.
        html("garden/a.html", desc="own text only")
        ok(run(content, out, cfg, quiet=True) == 1, "og:description without the disclosure fails")
        html("garden/a.html", desc="own \u2014 " + LEAD)
        ok(run(content, out, cfg, quiet=True) == 1, "only the lead, not the full text, fails")
        html("garden/a.html", desc=FULL + " \u2014 own")
        ok(run(content, out, cfg, quiet=True) == 1, "disclosure present but not LAST fails (the summary leads; the card carries its own line)")
        html("garden/a.html", card=False)
        os.remove(os.path.join(out, "garden", "a-og-image.webp"))
        ok(run(content, out, cfg, quiet=True) == 1, "og:image naming a card that was not emitted fails")
        html("garden/a.html")
        html("garden/a.html", byline=False)
        ok(run(content, out, cfg, quiet=True) == 1, "page without the byline fails")
        html("garden/a.html")
        html("colophon.html", byline=True)
        ok(run(content, out, cfg, quiet=True) == 1, "byline on the colophon (linking to itself) fails")
        html("colophon.html", byline=False)
        os.remove(os.path.join(out, "colophon.html")); os.remove(os.path.join(content, "colophon.md"))
        ok(run(content, out, cfg, quiet=True) == 1, "colophon page absent (the link target) fails")
        md("colophon.md"); html("colophon.html", byline=False)
        feed([("t", "own \u2014 " + FULL), ("a", "own \u2014 " + LEAD)])
        ok(run(content, out, cfg, quiet=True) == 1, "feed item carrying only the lead, not the full text, fails")
        feed([])
        ok(run(content, out, cfg, quiet=True) == 1, "feed with no items while pages exist fails")
        feed([("t", "own \u2014 " + FULL), ("a", "own \u2014 " + FULL)])
        ok(run(content, out, cfg, quiet=True) == 0, "back to green")
        # The plugin entry absent or disabled from the config: this site does not publish without it.
        with open(cfg, "w") as f:
            f.write("configuration:\n  ignorePatterns:\n    - private\nplugins:\n" + PLUGIN.replace("enabled: true\n    options", "enabled: false\n    options"))
        ok(disclosure_config(cfg) is None and run(content, out, cfg, quiet=True) == 1, "disabled plugin entry fails")
        with open(cfg, "w") as f:
            f.write("configuration:\n  ignorePatterns:\n    - private\nplugins:\n  - source: \"@quartz-community/footer\"\n    enabled: true\n")
        ok(disclosure_config(cfg) is None and run(content, out, cfg, quiet=True) == 1, "no plugin entry fails")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"selftest: {'ok' if fails == 0 else str(fails) + ' failed'}")
    return 0 if fails == 0 else 1


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("content", nargs="?")
    ap.add_argument("output", nargs="?")
    ap.add_argument("--config", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "quartz.config.yaml"))
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args(argv)
    if a.selftest:
        return selftest()
    if not a.content or not a.output:
        ap.error("need <content-dir> <output-dir> (or --selftest)")
    if not os.path.isdir(a.content) or not os.path.isdir(a.output):
        print("CANNOT EVALUATE: content or output directory does not exist", file=sys.stderr)
        return 2
    return run(a.content, a.output, a.config)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
