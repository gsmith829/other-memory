#!/usr/bin/env python3
"""No third-party origins in the built site -- patch before the build, prove after, then
write the Content-Security-Policy that the clean output makes possible. journey-site#34.
Called by site/quartz/build.sh; stdlib only.

    no-third-party.py patch <quartz-workdir>              # BEFORE `quartz build`
    no-third-party.py check <output-dir> --csp-inc <path> # AFTER it
    no-third-party.py --selftest

The pin comes from the environment (VENDOR_MERMAID), set once in build.sh next to the
upstream Quartz pin so both move in one reviewed diff.

WHY. Upstream Quartz v5 plugins hard-code runtime loads from public CDNs -- the graph view
injects d3 + pixi from jsdelivr on every page, and obsidian-flavored-markdown imports
mermaid from cdnjs on pages with a diagram -- plus a preconnect hint to cdnjs in every
page head. No option turns any of it off and no integrity attribute guards it. For a site
whose story is "the private stuff stayed private", executing a third party's JavaScript
at read time (and telling that third party who is reading) is the wrong posture.

The graph is OFF (quartz.config.yaml, Joe, 2026-09-20, cold read round 3), so d3 and
pixi are no longer vendored, rewritten or patched here (journey-site#141 left 2.6 MB of
them in every deploy, loaded by no page). If the graph is ever re-enabled, its d3/pixi
CDN loads reach the output unrewritten and `check` FAILS the build naming them -- turning
the graph back on is a deliberate act that brings its vendoring back with it, reviewed.

WHY PATCH BEFORE THE BUILD, NOT REWRITE AFTER. Quartz names its emitted scripts by content
hash and they are served immutable for 30 days. A post-build rewrite changes the bytes but
not the name, so every cache between the origin and a reader -- Cloudflare's edge, the
browser -- keeps serving the old bytes with the CDN URL in them. Measured 2026-09-15: the
first attempt did exactly that and the browser loaded mermaid from cdnjs off a cached
script while the origin was clean. Patching the plugin sources in the upstream checkout
before the build means the emitted file is named for what it actually contains.

The vendored copies are the SAME npm-published files the CDNs serve, at versioned paths
(/static/vendor/<lib>-<version>/...) so a bump changes the URL and no cache can pin an
old copy under a new name.

The fonts plugin writes the self-hosted font URLs as absolute https://<baseUrl>/... . That
breaks the moment the same build is served from any other hostname (a Pages preview, a
second public name): cross-origin font loads and a `font-src 'self'` policy both refuse
them. `check` rewrites them to root-relative paths; the CSS file is not content-hashed.

Failure modes are LOUD by construction: an expected CDN URL that is no longer in the plugin
source (upstream changed its loader -- bump the pin / the pattern here) exits 1; a vendored
target missing from the output exits 1; any surviving third-party URL exits 1 naming the
file. There is no path through this script where a CDN reference survives silently.

Known and accepted: the explorer plugin rebuilds its sort/filter functions with
`new Function` from a serialized copy of its own defaults; under this policy that throws
one EvalError per page, is caught by the plugin, and it falls back to the built-in
functions, which are the same defaults. Verified in a browser 2026-09-15: tree renders
correctly. 'unsafe-eval' is not worth buying to silence a log line.
"""
import argparse
import base64
import hashlib
import os
import re
import shutil
import sys
import tempfile

PLUGIN_ROOT = os.path.join("node_modules", "@quartz-community")


def pins():
    p = {k: os.environ.get(v) for k, v in (("mermaid", "VENDOR_MERMAID"),)}
    missing = [k for k, v in p.items() if not v]
    if missing:
        sys.exit(f"CANNOT EVALUATE: vendor pin(s) not set in the environment: {missing}")
    return p


def rewrites(p):
    """CDN URL (exactly as the compiled plugin emits it) -> versioned local path.
    Keyed by the FULL URL on purpose: a plugin bump that changes the version changes the
    key, the 'not found' assertion fires, and the vendor pin gets bumped in the same change."""
    return {
        f"https://cdnjs.cloudflare.com/ajax/libs/mermaid/{p['mermaid']}/mermaid.esm.min.mjs":
            f"/static/vendor/mermaid-{p['mermaid']}/mermaid.esm.min.mjs",
    }


# Exact strings deleted from the OUTPUT (HTML is not content-hashed). A removal that finds
# nothing is not a failure -- upstream may stop emitting it; the survivor scan is the check.
REMOVALS = [
    '<link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin="anonymous"/>',
]

# Any of these surviving anywhere in the output is a failure, matched or not.
FORBIDDEN_HOSTS = re.compile(
    r"https?://(?:[a-z0-9-]+\.)*(?:cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|"
    r"esm\.sh|cdn\.skypack\.dev|fonts\.googleapis\.com|fonts\.gstatic\.com|"
    r"ajax\.googleapis\.com|code\.jquery\.com)(?![\w.-])",
    re.IGNORECASE,
)
TEXT_EXT = {".js", ".mjs", ".cjs", ".html", ".htm", ".css", ".xml", ".json", ".svg", ".txt", ".map"}
# journey-site#49: a stylesheet that url()s an absolute origin is a resource load from a third
# party, whatever the host -- FORBIDDEN_HOSTS names CDNs, but a `url(https://github.com/...)`
# in a CSS file the build copied wholesale (giscus's, shipped by upstream's static emitter with
# the comments plugin disabled) is the same posture failure with a host nobody listed. An <a>
# to github.com in a page is a link a reader may follow; a url() in CSS is a fetch the browser
# makes. Only the second is forbidden here. Self-hosted absolute font URLs are relativised
# earlier in check() and so never reach this rule.
CSS_REMOTE_URL = re.compile(r"url\(\s*['\"]?(https?:)?//[^)'\"\s]+", re.IGNORECASE)
FONT_CSS = os.path.join("static", "fonts", "quartz-fonts.css")
ABS_FONT_URL = re.compile(r"url\(https?://[^/)]+(/static/fonts/[^)]+)\)")

INLINE_SCRIPT = re.compile(r"<script\b([^>]*)>(.*?)</script>", re.S | re.I)
SRC_ATTR = re.compile(r"\bsrc\s*=", re.I)

HARDENING = [
    ("X-Content-Type-Options", "nosniff"),
    ("X-Frame-Options", "DENY"),
    ("Referrer-Policy", "strict-origin-when-cross-origin"),
    ("Permissions-Policy", "camera=(), microphone=(), geolocation=()"),
]


def text_files(root):
    for dirpath, _, names in os.walk(root):
        for n in names:
            if os.path.splitext(n)[1].lower() in TEXT_EXT:
                yield os.path.join(dirpath, n)


def read(path):
    with open(path, "r", encoding="utf-8", errors="surrogateescape") as f:
        return f.read()


def write(path, s):
    with open(path, "w", encoding="utf-8", errors="surrogateescape") as f:
        f.write(s)


def replace_all(root, table):
    """Replace every key of `table` with its value under root. Returns {key: count}."""
    counts = {k: 0 for k in table}
    for path in text_files(root):
        s = read(path)
        new = s
        for k, v in table.items():
            n = new.count(k)
            if n:
                counts[k] += n
                new = new.replace(k, v)
        if new != s:
            write(path, new)
    return counts


def css_remote_loads(root):
    """[(relpath, lineno, url)] for every absolute-origin url() in any stylesheet under root."""
    found = []
    for path in text_files(root):
        if not path.lower().endswith(".css"):
            continue
        rel = os.path.relpath(path, root)
        with open(path, "r", encoding="utf-8", errors="surrogateescape") as f:
            for i, line in enumerate(f, 1):
                for m in CSS_REMOTE_URL.finditer(line):
                    found.append((rel, i, m.group(0)[:80]))
    return found


def survivors(root):
    """[(relpath, lineno, host)] for every forbidden third-party URL left under root."""
    found = []
    for path in text_files(root):
        rel = os.path.relpath(path, root)
        with open(path, "r", encoding="utf-8", errors="surrogateescape") as f:
            for i, line in enumerate(f, 1):
                if not FORBIDDEN_HOSTS.search(line):
                    continue
                for m in FORBIDDEN_HOSTS.finditer(line):
                    found.append((rel, i, m.group(0)))
    return found


def inline_script_hashes(root):
    """sha256 (base64) of every distinct inline <script> body in the HTML output."""
    hashes = {}
    for path in text_files(root):
        if not path.lower().endswith((".html", ".htm")):
            continue
        for m in INLINE_SCRIPT.finditer(read(path)):
            attrs, body = m.group(1), m.group(2)
            if SRC_ATTR.search(attrs) or not body.strip():
                continue
            # The browser hashes the exact bytes between the tags -- no strip, no normalize.
            digest = hashlib.sha256(body.encode("utf-8", "surrogateescape")).digest()
            hashes[base64.b64encode(digest).decode()] = body[:60]
    return hashes


def build_csp(hashes):
    script_src = " ".join(["'self'"] + [f"'sha256-{h}'" for h in sorted(hashes)])
    return "; ".join([
        "default-src 'self'",
        f"script-src {script_src}",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "upgrade-insecure-requests",
    ])


def write_headers(root, csp):
    """Cloudflare Pages `_headers`: the same policy and hardening nginx serves on korba."""
    lines = ["/*", f"  Content-Security-Policy: {csp}"]
    lines += [f"  {k}: {v}" for k, v in HARDENING]
    # Long-lived caching only where the NAME changes with the content (see nginx.conf).
    lines += ["", "/static/vendor/*", "  Cache-Control: public, max-age=2592000, immutable",
              "", "/static/scripts/*", "  Cache-Control: public, max-age=2592000, immutable",
              "", "/static/resource-*", "  Cache-Control: public, max-age=2592000, immutable", ""]
    write(os.path.join(root, "_headers"), "\n".join(lines))


def write_csp_inc(path, csp):
    write(path, "# generated by site/quartz/no-third-party.py -- included inside nginx's server block\n"
                f'add_header Content-Security-Policy "{csp}" always;\n')


def patch(workdir, p, quiet=False):
    """Point the plugin sources at the vendored paths BEFORE Quartz bundles them."""
    say = (lambda *a: None) if quiet else print
    root = os.path.join(workdir, PLUGIN_ROOT)
    if not os.path.isdir(root):
        say(f"CANNOT EVALUATE: {root} does not exist (npm ci not run?)")
        return 2
    fails = 0
    counts = replace_all(root, rewrites(p))
    for url, n in counts.items():
        if n == 0:
            say(f"FAIL: expected CDN URL not found in any plugin source (upstream loader changed?): {url}")
            fails += 1
        else:
            say(f"patched {n:3d}x  {url} -> {rewrites(p)[url]}")
    if fails:
        say(f"patch: {fails} failure(s)")
        return 1
    say("patch: ok")
    return 0


def check(root, csp_inc, p, quiet=False):
    say = (lambda *a: None) if quiet else print
    counts = replace_all(root, {r: "" for r in REMOVALS})
    for gone in REMOVALS:
        say(f"removed {counts[gone]:3d}x  {gone[:70]}")
    fonts = os.path.join(root, FONT_CSS)
    if os.path.isfile(fonts):
        s = read(fonts)
        new, n = ABS_FONT_URL.subn(r"url(\1)", s)
        if n:
            write(fonts, new)
        say(f"relativised {n} absolute font URL(s) in {FONT_CSS}")
    fails = 0
    for local in rewrites(p).values():
        target = os.path.join(root, local.lstrip("/"))
        if not os.path.isfile(target) or os.path.getsize(target) == 0:
            say(f"FAIL: vendored file missing or empty: {local}")
            fails += 1
    for url in rewrites(p):
        if any(url in read(f) for f in text_files(root)):
            say(f"FAIL: CDN URL still in output -- was `patch` run before the build?: {url}")
            fails += 1
    left = survivors(root)
    for rel, ln, host in left:
        say(f"FAIL: third-party URL survives: {rel}:{ln}  {host}")
    fails += len(left)
    loads = css_remote_loads(root)
    for rel, ln, url in loads:
        say(f"FAIL: stylesheet loads a remote resource: {rel}:{ln}  {url}")
    fails += len(loads)
    if fails:
        say(f"check: {fails} failure(s)")
        return 1
    hashes = inline_script_hashes(root)
    csp = build_csp(hashes)
    write_headers(root, csp)
    write_csp_inc(csp_inc, csp)
    say(f"check: ok -- 0 third-party origins in output; CSP allows {len(hashes)} inline "
        f"script hash(es); wrote _headers and {csp_inc}")
    return 0


def selftest():
    fails = 0

    def ok(cond, msg):
        nonlocal fails
        if not cond:
            print("  FAIL", msg)
            fails += 1

    p = {"mermaid": "11.4.0"}
    R = rewrites(p)
    tmp = tempfile.mkdtemp(prefix="no-third-party-selftest-")
    try:
        # --- patch: a fake upstream checkout with one plugin source naming the mermaid URL
        work = os.path.join(tmp, "work")
        plug = os.path.join(work, PLUGIN_ROOT, "obsidian-flavored-markdown", "dist")
        os.makedirs(plug)
        write(os.path.join(plug, "index.js"),
              "Promise.all([" + ",".join(f'e("{u}")' for u in R) + "])")
        write(os.path.join(plug, "index.js.map"), " ".join(R))  # bare URLs, as a source map carries them
        ok(patch(work, p, quiet=True) == 0, "patch succeeds when every URL is present")
        s = read(os.path.join(plug, "index.js"))
        ok(all(u not in s for u in R) and all(v in s for v in R.values()), "patch rewrote every URL")
        ok(all(u not in read(os.path.join(plug, "index.js.map")) for u in R), "bare URLs in the map rewritten too")
        ok(patch(work, p, quiet=True) == 1, "a second patch finds nothing and FAILS (loader changed)")
        ok(patch(os.path.join(tmp, "nowhere"), p, quiet=True) == 2, "no node_modules -> CANNOT EVALUATE")

        # --- check: a fake output with the vendored targets, a preconnect, absolute fonts,
        #     and one page with src'd / real / empty inline scripts
        out = os.path.join(tmp, "out")
        os.makedirs(os.path.join(out, "static", "scripts"))
        os.makedirs(os.path.join(out, "static", "fonts"))
        for v in R.values():
            os.makedirs(os.path.dirname(os.path.join(out, v.lstrip("/"))), exist_ok=True)
            write(os.path.join(out, v.lstrip("/")), "// vendored\n")
        write(os.path.join(out, "static", "scripts", "s.js"), " ".join(R.values()))
        write(os.path.join(out, "p.html"), "<html><head>" + REMOVALS[0] + "</head>"
              '<script src="/x.js"></script><script>const a = 1;\n</script>'
              '<script type="application/javascript"></script></html>')
        write(os.path.join(out, FONT_CSS), "@font-face{src:url(https://example.test/static/fonts/a.ttf) format('truetype');}\n"
                                           "@font-face{src:url(https://example.test/static/fonts/b.ttf);}\n")
        inc = os.path.join(tmp, "csp.inc")
        ok(check(out, inc, p, quiet=True) == 0, "clean output passes")
        ok(REMOVALS[0] not in read(os.path.join(out, "p.html")), "preconnect hint removed")
        fc = read(os.path.join(out, FONT_CSS))
        ok("example.test" not in fc and "url(/static/fonts/a.ttf)" in fc, "font URLs made root-relative")
        expected = base64.b64encode(hashlib.sha256(b"const a = 1;\n").digest()).decode()
        hdr = read(os.path.join(out, "_headers"))
        ok(f"'sha256-{expected}'" in hdr, "inline script hash is the exact-bytes hash")
        ok(hdr.count("sha256-") == 1, "src'd and empty scripts get no hash")
        ok("X-Frame-Options: DENY" in hdr and "/static/vendor/*" in hdr and "/static/*\n" not in hdr,
           "_headers carries hardening + cache only for hashed/vendored paths")
        ok(read(inc).startswith("# generated") and "frame-ancestors 'none'" in read(inc), "csp.inc is an nginx add_header line")

        # Negative 1: a surviving third-party URL must fail and be the thing named.
        write(os.path.join(out, "q.html"), '<link href="https://fonts.googleapis.com/css2?family=X" rel="stylesheet">')
        ok(check(out, inc, p, quiet=True) == 1, "surviving font-host URL fails")
        left = survivors(out)
        ok(len(left) == 1 and left[0][2] == "https://fonts.googleapis.com", "the survivor is named")
        os.remove(os.path.join(out, "q.html"))
        # Negative 2 (journey-site#49): a stylesheet that url()s ANY absolute origin fails, host listed or not;
        # a root-relative url() and an <a> to the same host in a page do not.
        write(os.path.join(out, "static", "dead.css"), ".x{background:url(https://github.com/a.png)}\n.y{background:url(/static/b.png)}\n")
        ok(check(out, inc, p, quiet=True) == 1, "stylesheet loading github.com fails")
        loads = css_remote_loads(out)
        ok(len(loads) == 1 and loads[0][0].endswith("dead.css") and loads[0][1] == 1, "the remote url() is named, the relative one is not")
        write(os.path.join(out, "static", "dead.css"), ".y{background:url(/static/b.png)}\n")
        write(os.path.join(out, "r.html"), '<a href="https://github.com/x/y">the mirror</a>')
        ok(check(out, inc, p, quiet=True) == 0, "a relative url() and a page LINK to github.com both pass")
        os.remove(os.path.join(out, "static", "dead.css")); os.remove(os.path.join(out, "r.html"))
        # Negative 2: a CDN URL still in the output (patch not run) must fail.
        write(os.path.join(out, "static", "scripts", "s.js"), " ".join(R))
        ok(check(out, inc, p, quiet=True) == 1, "unpatched CDN URL in output fails")
        write(os.path.join(out, "static", "scripts", "s.js"), " ".join(R.values()))
        # Negative 3: a vendored target missing must fail.
        mm = os.path.join(out, list(R.values())[0].lstrip("/"))
        os.remove(mm)
        ok(check(out, inc, p, quiet=True) == 1, "missing vendored file fails")
        write(mm, "// vendored\n")
        # Negative 4: the graph's d3/pixi CDN loads, no longer rewritten, must FAIL the check if
        # they ever reach the output again (the graph re-enabled) -- named, not exempted.
        write(os.path.join(out, "static", "scripts", "graph.js"),
              'e("https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js");e("https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.js")\n')
        ok(check(out, inc, p, quiet=True) == 1 and len(survivors(out)) == 2 and survivors(out)[0][0] == os.path.join("static", "scripts", "graph.js"),
           "an un-vendored graph load fails the build, named")
        os.remove(os.path.join(out, "static", "scripts", "graph.js"))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"selftest: {'ok' if fails == 0 else str(fails) + ' failed'}")
    return 0 if fails == 0 else 1


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("mode", nargs="?", choices=["patch", "check"])
    ap.add_argument("path", nargs="?", help="patch: the upstream Quartz checkout; check: the output dir")
    ap.add_argument("--csp-inc", help="check: where to write the nginx add_header include")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args(argv)
    if a.selftest:
        return selftest()
    if not a.mode or not a.path:
        ap.error("need `patch <workdir>` or `check <output-dir> --csp-inc <path>` (or --selftest)")
    p = pins()
    if a.mode == "patch":
        return patch(os.path.abspath(a.path), p)
    if not a.csp_inc:
        ap.error("check needs --csp-inc")
    if not os.path.isfile(os.path.join(a.path, "index.html")):
        print(f"CANNOT EVALUATE: {a.path} has no index.html", file=sys.stderr)
        return 2
    return check(os.path.abspath(a.path), os.path.abspath(a.csp_inc), p)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
