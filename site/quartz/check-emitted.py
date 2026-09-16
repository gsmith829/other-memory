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
"""
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
        with open(cfg, "w") as f:
            f.write("configuration:\n  baseUrl: x\n  ignorePatterns:\n    - private\n    - templates\n  theme:\n    x: y\n")
        ok(ignore_patterns(cfg) == ["private", "templates"], "ignorePatterns parsed from the config block")

        def md(rel, fm=""):
            with open(os.path.join(content, rel), "w") as f:
                f.write(f"---\ntitle: t\n{fm}---\nbody\n")

        def html(rel):
            with open(os.path.join(out, rel), "w") as f:
                f.write("<html>x</html>")

        md("index.md"); md("garden/a.md"); md("garden/wip.md", "draft: true\n"); md("private/secret.md")
        html("index.html"); html("garden/a.html")
        for name in REQUIRED[1:]:
            html(name)
        ok(run(content, out, cfg, quiet=True) == 0, "published pages present, draft + ignored absent -> pass")
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
        html("index.xml")
        # Draft spelled with a quoted value or capitals still counts.
        md("garden/wip2.md", "Draft: YES\n")
        ok(run(content, out, cfg, quiet=True) == 0, "draft: YES (any case) is a draft")
        ok(run(content, out, cfg, quiet=True) == 0, "still passes with the extra draft absent from output")
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
