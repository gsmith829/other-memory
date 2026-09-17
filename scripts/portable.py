#!/usr/bin/env python3
"""Rewrite Obsidian-dialect markdown into the portable subset, in place. journey-site#6, bake-off v3.

    portable.py <root> [<root> ...]        rewrite every *.md under the roots; exit 1 on an unresolved link
    portable.py --lint <root> [<root> ...] change nothing; exit 1 if any page still carries the dialect
    portable.py --selftest

The roots are treated as ONE tree (the build assembles content/ and the sample the same way), so a
link from the sample into content/ resolves and becomes a relative path that works after assembly.

The portable subset -- renders in Obsidian, on GitHub, and in every generator considered, with no
Obsidian-specific plugin:
  links     [[garden/x|text]] / [[x]]  ->  [text](../garden/x.md)   relative, .md kept, Obsidian's own
            "shortest path" resolution (basename match, shortest wins) decides which file [[x]] meant
  callouts  > [!info] Title             ->  > [!NOTE]               GitHub's five alert types, no custom
                                            > **Title**             title (GitHub has none); the title
                                            >                       survives as a bold first paragraph
  frontmatter                            unchanged (YAML is universal)
"""
import os, re, sys, tempfile

TYPES = {"note": "NOTE", "info": "NOTE", "quote": "NOTE", "cite": "NOTE", "abstract": "NOTE", "summary": "NOTE",
         "tip": "TIP", "hint": "TIP", "example": "TIP", "success": "TIP",
         "important": "IMPORTANT", "warning": "WARNING", "attention": "WARNING",
         "caution": "CAUTION", "danger": "CAUTION", "error": "CAUTION", "failure": "CAUTION", "bug": "CAUTION"}
WIKI = re.compile(r"\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]")
CALLOUT = re.compile(r"^> \[!(\w+)\]([+-]?)[ \t]*(.*)$")
GFM = {"NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"}  # already portable: exactly this, uppercase, no title


def tree(roots):
    """virtual path (relative to the assembled tree) -> real path, for every .md under the roots"""
    t = {}
    for root in roots:
        for d, _, names in os.walk(root):
            for n in names:
                if n.endswith(".md"):
                    real = os.path.join(d, n)
                    t[os.path.relpath(real, root).replace(os.sep, "/")] = real
    return t


def resolve(target, files):
    """Obsidian shortest-path: the candidate whose path ends with the target, shortest path wins."""
    want = target.strip().lower()
    cands = [v for v in files if v[:-3].lower() == want or v[:-3].lower().endswith("/" + want)]
    return min(cands, key=len) if cands else None


def relpath(src_virtual, dst_virtual):
    r = os.path.relpath(dst_virtual, os.path.dirname(src_virtual) or ".").replace(os.sep, "/")
    return r if r.startswith(".") else "./" + r


def convert(text, src_virtual, files):
    unresolved, n_links, n_callouts = [], 0, 0

    def link(m):
        nonlocal n_links
        target, heading, alias = m.group(1), m.group(2), m.group(3)
        dst = resolve(target, files)
        if dst is None:
            unresolved.append(target); return m.group(0)
        n_links += 1
        text_ = alias if alias is not None else target
        return f"[{text_}]({relpath(src_virtual, dst)}{'#' + heading if heading else ''})"

    out = []
    for line in text.split("\n"):
        m = CALLOUT.match(line)
        if m and m.group(1) in GFM and not m.group(2) and not m.group(3).strip():
            out.append(line)  # a GitHub alert as written: not dialect, not counted
            continue
        if m and m.group(1).lower() in TYPES:
            n_callouts += 1
            out.append(f"> [!{TYPES[m.group(1).lower()]}]")
            if m.group(3).strip():
                # its own paragraph: without the blank quote line the title runs into the body
                out.append(f"> **{m.group(3).strip()}**")
                out.append(">")
            continue
        out.append(WIKI.sub(link, line))
    return "\n".join(out), n_links, n_callouts, unresolved


def main(argv):
    if argv[:1] == ["--selftest"]:
        return selftest()
    lint = argv[:1] == ["--lint"]
    if lint:
        argv = argv[1:]
    if not argv:
        print(__doc__); return 2
    files = tree(argv)
    if not files:
        print("CANNOT EVALUATE: no .md files under", argv); return 2
    bad = 0
    for virtual, real in sorted(files.items()):
        src = open(real, encoding="utf-8").read()
        new, nl, nc, un = convert(src, virtual, files)
        for u in un:
            print(f"UNRESOLVED: {virtual}: [[{u}]]"); bad += 1
        if lint:
            # The site is written in the portable subset (D12): a page the converter would change is a
            # page carrying the Obsidian dialect -- a wikilink, an Obsidian-only callout -- and fails.
            if new != src or nl or nc:
                print(f"DIALECT: {virtual}: {nl} wikilink(s), {nc} Obsidian callout(s) -- run scripts/portable.py on it"); bad += 1
            continue
        if new != src:
            open(real, "w", encoding="utf-8").write(new)
        print(f"{virtual}: {nl} link(s), {nc} callout(s){' -- rewritten' if new != src else ''}")
    if lint:
        print(f"portable --lint: {len(files)} page(s) inspected, {bad} problem(s)")
    return 1 if bad else 0


def selftest():
    fails = 0
    files = {"index.md": "", "colophon.md": "", "garden/x.md": "", "awakening/index.md": "", "awakening/posts/act-1.md": ""}
    def ok(c, msg):
        nonlocal fails
        if not c: fails += 1; print("  FAIL", msg)
    new, nl, nc, un = convert("See [[garden/x|the x]] and [[colophon]].", "index.md", files)
    ok(new == "See [the x](./garden/x.md) and [colophon](./colophon.md).", f"root links: {new}")
    new, *_ = convert("[[x]] [[index|start]] [[act-1|Act 1]]", "awakening/posts/act-1.md", files)
    ok(new == "[x](../../garden/x.md) [start](../../index.md) [Act 1](./act-1.md)", f"nested links: {new}")
    new, *_ = convert("[[index|Other Memory]]", "awakening/index.md", files)
    ok(new == "[Other Memory](../index.md)", f"[[index]] from a folder index must reach the ROOT index (shortest path): {new}")
    new, nl, nc, un = convert("[[nope]]", "index.md", files)
    ok(un == ["nope"] and new == "[[nope]]", "unresolved link is reported and left alone")
    new, _, nc, _ = convert("> [!info] The short version\n> body\n\n> [!danger]\n> x", "index.md", files)
    ok(new == "> [!NOTE]\n> **The short version**\n>\n> body\n\n> [!CAUTION]\n> x" and nc == 2, f"callouts: {new!r}")
    new, *_ = convert("> [!quote] Skeleton copy\n> t", "index.md", files)
    ok(new.startswith("> [!NOTE]\n> **Skeleton copy**"), "quote -> NOTE with title kept")
    new, _, nc, _ = convert("> [!custom] x", "index.md", files)
    ok(nc == 0 and new == "> [!custom] x", "unknown callout type is left alone, not guessed")
    new, _, nc, _ = convert("> [!NOTE]\n> **T**\n>\n> body", "index.md", files)
    ok(nc == 0 and new == "> [!NOTE]\n> **T**\n>\n> body", "an already-portable alert is a no-op and not counted (lint idempotence)")
    new, _, nc, _ = convert("> [!NOTE] with a title", "index.md", files)
    ok(nc == 1 and new == "> [!NOTE]\n> **with a title**\n>", "a GFM type WITH a title is still dialect (GitHub has no titles)")
    ok(convert("`[[not a link]]` stays? no -- documented: code spans are not special-cased", "index.md", files)[3] == ["not a link"],
       "a wikilink inside a code span is reported unresolved rather than silently rewritten")
    print("selftest:", "ok" if not fails else f"{fails} failure(s)")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
