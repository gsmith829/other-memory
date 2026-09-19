#!/usr/bin/env python3
"""Every page Awakening was meant to publish was emitted -- and nothing else was -- and the
AI-authorship disclosure reached every surface. journey-site#50 (the Astro-shaped twin of
site/quartz/check-emitted.py, #5/#34/#20/#21/#55).

    check-emitted.py <content-dir> <output-dir> [--disclosure site/starlight/disclosure.json]
    check-emitted.py --selftest

Run by site/starlight/build.sh after `astro build` (so by the forge's runner and by Cloudflare
Pages too). Stdlib only (no pip on bijaz).

  1. every markdown file the build assembles -- content/awakening/** and content/colophon.md,
     minus `draft: true` -- has its page in the output, at Astro's directory-index path
     (awakening/x.md -> awakening/x/index.html, colophon.md -> colophon/index.html);
  2. the inverse, which matters more: the garden (content/garden/, content/index.md) and any draft
     must NOT be in the output -- "it was excluded" is a claim about the build, this is the
     measurement -- and the site root is exactly the redirect to /awakening/, not a page;
  3. the feed, the sitemap index, the Pages `_headers` and `_redirects` (whose root rule is the
     exact 301 to /awakening/), Pagefind's index and Astro's hashed asset dir exist and are non-empty;
  4. the disclosure (D6a; site/starlight/disclosure.json, verbatim the colophon's short version):
     every page's og:description and <meta name="description"> END with the full text (the page's
     own summary leads); every page's og:image names a card under /og/ that exists non-empty (the
     card carries the lead as its own line -- an image, checked by eye on the PR, its presence
     here); every page but the colophon carries the byline, the colophon does not (it is the
     link's target) and it exists; every feed item's description contains the full text;
  5. the portable subset rendered: no `[!` alert marker survives into HTML (an alert that did not
     become an aside), and no `class="new"` (an unresolved link).
"""
import argparse
import html as html_mod
import json
import os
import re
import shutil
import sys
import tempfile

FRONTMATTER = re.compile(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", re.S)
DRAFT = re.compile(r"^draft:\s*(true|yes)\s*$", re.M | re.I)
REQUIRED = ("rss.xml", "sitemap-index.xml", "_headers", "_redirects", "pagefind/pagefind.js")
# The root redirect Pages applies before any asset (site/starlight/public/_redirects): the exact
# rule, so a stub-only root (a "Redirecting to" flash for a cold reader) cannot come back quietly.
ROOT_REDIRECT_RULE = "/ /awakening/ 301"
ASSEMBLED = ("awakening/", "colophon.md")  # what build.sh copies into the docs dir, and nothing else
OG_DESC = re.compile(r'<meta property="og:description" content="([^"]*)"')
META_DESC = re.compile(r'<meta name="description" content="([^"]*)"')
OG_IMAGE = re.compile(r'<meta property="og:image" content="([^"]*)"')
REFRESH = re.compile(r'<meta http-equiv="refresh" content="\d+;\s*url=([^"]+)"', re.I)
# Astro appends its scoped-style class to the attribute (`class="disclosure-byline astro-xxxx"`), so the
# marker is the class name followed by a space or the closing quote, not the whole attribute.
BYLINE = re.compile(r'class="disclosure-byline(?:\s|")')
FEED_ITEM = re.compile(r"<item>(.*?)</item>", re.S)
ITEM_DESC = re.compile(r"<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</description>", re.S)
ALERT_MARKER = re.compile(r"\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]")
UNRESOLVED = re.compile(r'class="[^"]*\bnew\b[^"]*"')


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


def is_draft(md_path):
    with open(md_path, encoding="utf-8", errors="replace") as f:
        head = f.read(8192)
    m = FRONTMATTER.match(head)
    return bool(m and DRAFT.search(m.group(1)))


def is_assembled(rel):
    return any(rel == a or (a.endswith("/") and rel.startswith(a)) for a in ASSEMBLED)


def html_for(rel):
    """content/awakening/x.md -> awakening/x/index.html ; content/awakening/index.md -> awakening/index.html ;
    content/colophon.md -> colophon/index.html (Astro's directory-index output)."""
    stem = rel[:-3]
    if stem.endswith("/index") or stem == "index":
        return stem + ".html"
    return stem + "/index.html"


def load_disclosure(path):
    try:
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
    except (OSError, ValueError):
        return None
    if not d.get("disclosure") or not d.get("lead") or not str(d["disclosure"]).startswith(str(d["lead"])):
        return None
    d.setdefault("colophonSlug", "colophon")
    return d


def read(path):
    with open(path, encoding="utf-8", errors="replace") as f:
        return f.read()


def check_disclosure(out, expected, dc, say):
    fails = 0
    disclosure = norm(dc["disclosure"])
    colophon = html_for(dc["colophonSlug"] + ".md")
    if not os.path.isfile(os.path.join(out, colophon)):
        say(f"MISSING: {colophon} -- the byline links to it")
        fails += 1
    for rel in expected:
        h = html_for(rel)
        target = os.path.join(out, h)
        if not os.path.isfile(target):
            continue  # already reported as MISSING
        page = read(target)
        for label, rx in (("og:description", OG_DESC), ("meta description", META_DESC)):
            m = rx.search(page)
            got = norm(html_mod.unescape(m.group(1))) if m else ""
            if not got.endswith(disclosure):
                say(f"NO DISCLOSURE: {h} {label} does not end with the disclosure (...{got[-60:]!r})")
                fails += 1
        m = OG_IMAGE.search(page)
        card = html_mod.unescape(m.group(1)) if m else ""
        card_rel = card.split("://", 1)[1].split("/", 1)[1] if "://" in card else card.lstrip("/")
        card_path = os.path.join(out, card_rel) if card_rel else ""
        if not card_rel.startswith("og/") or not card_rel.endswith(".png") or not os.path.isfile(card_path) or os.path.getsize(card_path) == 0:
            say(f"NO CARD: {h} og:image is {card or '<absent>'!r}, expected a generated /og/<id>.png that exists")
            fails += 1
        has_byline = bool(BYLINE.search(page))
        if h == colophon and has_byline:
            say(f"BYLINE ON COLOPHON: {h} carries the byline that links to itself")
            fails += 1
        elif h != colophon and not has_byline:
            say(f"NO BYLINE: {h}")
            fails += 1
    feed = os.path.join(out, "rss.xml")
    items = FEED_ITEM.findall(read(feed)) if os.path.isfile(feed) else []
    acts = [r for r in expected if r.startswith("awakening/") and r != "awakening/index.md"]
    if acts and not items:
        say("NO DISCLOSURE: rss.xml has no items to carry it")
        fails += 1
    for it in items:
        m = ITEM_DESC.search(it)
        title = re.search(r"<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>", it, re.S)
        if not m or disclosure not in norm(html_mod.unescape(m.group(1))):
            say(f"NO DISCLOSURE: feed item {title.group(1) if title else '?'!r} description lacks it")
            fails += 1
    return fails


def run(content, out, disclosure_path, quiet=False):
    say = (lambda *a: None) if quiet else print
    expected, excluded = [], []
    for dirpath, _, names in os.walk(content):
        for n in sorted(names):
            if not n.endswith(".md"):
                continue
            rel = os.path.relpath(os.path.join(dirpath, n), content).replace(os.sep, "/")
            if not is_assembled(rel):
                excluded.append((rel, "not assembled (the garden is Other Memory's)"))
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
        h = html_for(rel)
        target = os.path.join(out, h)
        if h == "index.html":
            # The site root is the redirect to the front door and nothing else.
            page = read(target) if os.path.isfile(target) else ""
            m = REFRESH.search(page)
            if not m or not m.group(1).rstrip("/").endswith("/awakening") or BYLINE.search(page):
                say(f"LEAKED: index.html must be only the redirect to /awakening/ (content/index.md is the garden's front door), got {m.group(1) if m else 'no redirect'!r}")
                fails += 1
            continue
        if os.path.exists(target):
            say(f"LEAKED: {rel} is excluded ({why}) but {h} was emitted")
            fails += 1
    for name in REQUIRED:
        p = os.path.join(out, name)
        if not os.path.isfile(p) or os.path.getsize(p) == 0:
            say(f"MISSING: {name}")
            fails += 1
    rp = os.path.join(out, "_redirects")
    if os.path.isfile(rp):
        rules = [l.strip() for l in open(rp, encoding="utf-8") if l.strip() and not l.lstrip().startswith("#")]
        if not rules or rules[0] != ROOT_REDIRECT_RULE:
            say(f"ROOT NOT REDIRECTED: _redirects' first rule is {rules[0] if rules else 'absent'!r}, want {ROOT_REDIRECT_RULE!r}")
            fails += 1
    astro = os.path.join(out, "_astro")
    if not os.path.isdir(astro) or not os.listdir(astro):
        say("MISSING: _astro/ (Astro's hashed assets) is absent or empty")
        fails += 1
    for dirpath, _, names in os.walk(out):
        for n in names:
            if not n.endswith(".html"):
                continue
            page = read(os.path.join(dirpath, n))
            rel = os.path.relpath(os.path.join(dirpath, n), out)
            if ALERT_MARKER.search(page):
                say(f"NOT PORTABLE: {rel} carries a raw alert marker -- an alert that did not become an aside")
                fails += 1
            if UNRESOLVED.search(page):
                say(f"UNRESOLVED LINK: {rel} carries class=\"new\"")
                fails += 1
    dc = load_disclosure(disclosure_path)
    if dc is None:
        say(f"MISSING: {disclosure_path} with `disclosure` + `lead` (a verbatim prefix) -- this site does not publish without the disclosure (journey-site#50)")
        fails += 1
    else:
        fails += check_disclosure(out, expected, dc, say)
    say(f"content pages: {len(expected)} expected, {len(excluded)} excluded on purpose, {fails} problem(s)")
    return 1 if fails else 0


def selftest():
    fails = 0

    def ok(cond, msg):
        nonlocal fails
        if not cond:
            print("  FAIL", msg)
            fails += 1

    tmp = tempfile.mkdtemp(prefix="check-emitted-starlight-")
    try:
        content, out = os.path.join(tmp, "content"), os.path.join(tmp, "dist")
        for d in ("content/awakening", "content/garden", "dist/awakening/act-1", "dist/colophon", "dist/og/awakening", "dist/pagefind", "dist/_astro"):
            os.makedirs(os.path.join(tmp, d), exist_ok=True)
        LEAD = "This is a real homelab owned by a human called Joe."
        FULL = LEAD + " The byline — Nagatha — is an AI persona, not a person."
        dpath = os.path.join(tmp, "disclosure.json")
        with open(dpath, "w", encoding="utf-8") as f:
            json.dump({"disclosure": FULL, "lead": LEAD, "colophonSlug": "colophon"}, f)

        def md(rel, fm=""):
            with open(os.path.join(content, rel), "w") as f:
                f.write(f"---\ntitle: t\n{fm}---\nbody\n")

        def html(rel, desc="own text — " + FULL, byline=True, card=True, body="x"):
            esc = html_mod.escape(desc, quote=True)
            stem = rel[: -len("/index.html")] if rel.endswith("/index.html") else rel[:-5]
            card_rel = f"og/{stem}.png"
            if card:
                os.makedirs(os.path.dirname(os.path.join(out, card_rel)), exist_ok=True)
                with open(os.path.join(out, card_rel), "wb") as f:
                    f.write(b"\x89PNG....")
            with open(os.path.join(out, rel), "w") as f:
                f.write(f'<html><head><meta property="og:description" content="{esc}"/><meta name="description" content="{esc}"/>'
                        f'<meta property="og:image" content="https://x/{card_rel}"/></head><body>'
                        + ('<p class="disclosure-byline"><span class="disclosure-byline-author">Nagatha</span> — an AI chronicler; <a href="/colophon/">what that means</a></p>' if byline else "")
                        + body + "</body></html>")

        def feed(items):
            with open(os.path.join(out, "rss.xml"), "w") as f:
                f.write("<rss><channel>" + "".join(f"<item><title><![CDATA[{t}]]></title><description><![CDATA[{d}]]></description></item>" for t, d in items) + "</channel></rss>")

        def plain(rel, body="x"):
            with open(os.path.join(out, rel), "w") as f:
                f.write(body)

        def redirect(url="/awakening/"):
            plain("index.html", f'<!doctype html><html><head><meta http-equiv="refresh" content="2;url={url}"></head></html>')

        md("awakening/index.md"); md("awakening/act-1.md"); md("colophon.md"); md("awakening/wip.md", "draft: true\n")
        md("index.md"); md("garden/a.md")
        html("awakening/index.html"); html("awakening/act-1/index.html"); html("colophon/index.html", byline=False)
        feed([("act 1", "own — " + FULL)])
        redirect()
        for name in REQUIRED[1:]:
            plain(name)
        plain("_redirects", "# comment\n" + ROOT_REDIRECT_RULE + "\n")
        plain("_astro/x.css")
        ok(run(content, out, dpath, quiet=True) == 0, "assembled pages present, garden + draft absent, root is the redirect, disclosure everywhere -> pass")
        ok(html_for("awakening/act-1.md") == "awakening/act-1/index.html" and html_for("colophon.md") == "colophon/index.html"
           and html_for("awakening/index.md") == "awakening/index.html", "Astro directory-index paths")
        # Negatives, each the exact silent failure it guards.
        plain("_redirects", "/ /awakening/ 302\n")
        ok(run(content, out, dpath, quiet=True) == 1, "a _redirects whose root rule is not the exact 301 fails")
        plain("_redirects", "# comment\n" + ROOT_REDIRECT_RULE + "\n")
        os.remove(os.path.join(out, "awakening", "act-1", "index.html"))
        ok(run(content, out, dpath, quiet=True) == 1, "missing assembled page fails")
        html("awakening/act-1/index.html")
        os.makedirs(os.path.join(out, "garden", "a"), exist_ok=True); html("garden/a/index.html")
        ok(run(content, out, dpath, quiet=True) == 1, "the garden emitted here fails (leak)")
        shutil.rmtree(os.path.join(out, "garden"))
        os.makedirs(os.path.join(out, "awakening", "wip"), exist_ok=True); html("awakening/wip/index.html")
        ok(run(content, out, dpath, quiet=True) == 1, "emitted draft fails (leak)")
        shutil.rmtree(os.path.join(out, "awakening", "wip"))
        html("index.html")  # the garden's front door rendered at the root instead of the redirect
        ok(run(content, out, dpath, quiet=True) == 1, "root rendered as a page instead of the redirect fails")
        redirect("/garden/")
        ok(run(content, out, dpath, quiet=True) == 1, "root redirecting elsewhere fails")
        redirect()
        os.remove(os.path.join(out, "rss.xml"))
        ok(run(content, out, dpath, quiet=True) == 1, "missing feed fails")
        feed([("act 1", "own — " + FULL)])
        os.remove(os.path.join(out, "pagefind", "pagefind.js"))
        ok(run(content, out, dpath, quiet=True) == 1, "missing pagefind fails")
        plain("pagefind/pagefind.js")
        html("awakening/act-1/index.html", desc="own text only")
        ok(run(content, out, dpath, quiet=True) == 1, "og:description without the disclosure fails")
        html("awakening/act-1/index.html", desc="own — " + LEAD)
        ok(run(content, out, dpath, quiet=True) == 1, "only the lead, not the full text, fails")
        html("awakening/act-1/index.html", desc=FULL + " — own")
        ok(run(content, out, dpath, quiet=True) == 1, "disclosure present but not LAST fails")
        html("awakening/act-1/index.html", card=False); os.remove(os.path.join(out, "og", "awakening", "act-1.png"))
        ok(run(content, out, dpath, quiet=True) == 1, "og:image naming a card that was not emitted fails")
        html("awakening/act-1/index.html", byline=False)
        ok(run(content, out, dpath, quiet=True) == 1, "page without the byline fails")
        html("awakening/act-1/index.html")
        html("colophon/index.html", byline=True)
        ok(run(content, out, dpath, quiet=True) == 1, "byline on the colophon fails")
        html("colophon/index.html", byline=False)
        html("awakening/act-1/index.html", body="<p>[!NOTE] not converted</p>")
        ok(run(content, out, dpath, quiet=True) == 1, "a raw alert marker in HTML fails")
        html("awakening/act-1/index.html", body='<a class="new" href="x">dangling</a>')
        ok(run(content, out, dpath, quiet=True) == 1, "an unresolved link (class new) fails")
        html("awakening/act-1/index.html")
        feed([("act 1", "own — " + LEAD)])
        ok(run(content, out, dpath, quiet=True) == 1, "feed item carrying only the lead fails")
        feed([])
        ok(run(content, out, dpath, quiet=True) == 1, "feed with no items while Acts exist fails")
        feed([("act 1", "own — " + FULL)])
        ok(run(content, out, dpath, quiet=True) == 0, "back to green")
        with open(dpath, "w") as f:
            json.dump({"disclosure": FULL, "lead": "not a prefix"}, f)
        ok(load_disclosure(dpath) is None and run(content, out, dpath, quiet=True) == 1, "lead that is not a prefix of the disclosure fails")
        ok(load_disclosure(os.path.join(tmp, "nope.json")) is None and run(content, out, os.path.join(tmp, "nope.json"), quiet=True) == 1, "missing disclosure file fails")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"selftest: {'ok' if fails == 0 else str(fails) + ' failed'}")
    return 0 if fails == 0 else 1


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("content", nargs="?")
    ap.add_argument("output", nargs="?")
    ap.add_argument("--disclosure", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "disclosure.json"))
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args(argv)
    if a.selftest:
        return selftest()
    if not a.content or not a.output:
        ap.error("need <content-dir> <output-dir> (or --selftest)")
    if not os.path.isdir(a.content) or not os.path.isdir(a.output):
        print("CANNOT EVALUATE: content or output directory does not exist", file=sys.stderr)
        return 2
    return run(a.content, a.output, a.disclosure)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
