#!/usr/bin/env python3
"""No third-party origins in the built site -- patch before the build, prove after, then
write the Content-Security-Policy that the clean output makes possible. journey-site#34.
Called by site/quartz/build.sh; stdlib only.

    no-third-party.py patch <quartz-workdir>              # BEFORE `quartz build`
    no-third-party.py check <output-dir> --csp-inc <path> # AFTER it
    no-third-party.py --selftest

Pins come from the environment (VENDOR_D3, VENDOR_PIXI, VENDOR_MERMAID), set once in
build.sh next to the upstream Quartz pin so all four move in one reviewed diff.

WHY. Upstream Quartz v5 plugins hard-code three runtime loads from public CDNs -- the graph
view injects d3 + pixi from jsdelivr on every page, and obsidian-flavored-markdown imports
mermaid from cdnjs on pages with a diagram -- plus a preconnect hint to cdnjs in every
page head. No option turns any of it off and no integrity attribute guards it. For a site
whose story is "the private stuff stayed private", executing a third party's JavaScript
at read time (and telling that third party who is reading) is the wrong posture.

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
    p = {k: os.environ.get(v) for k, v in (("d3", "VENDOR_D3"), ("pixi", "VENDOR_PIXI"), ("mermaid", "VENDOR_MERMAID"))}
    missing = [k for k, v in p.items() if not v]
    if missing:
        sys.exit(f"CANNOT EVALUATE: vendor pin(s) not set in the environment: {missing}")
    return p


def rewrites(p):
    """CDN URL (exactly as the compiled plugin emits it) -> versioned local path.
    Keyed by the FULL URL on purpose: a plugin bump that changes the version changes the
    key, the 'not found' assertion fires, and the vendor pin gets bumped in the same change."""
    return {
        "https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js": f"/static/vendor/d3-{p['d3']}/d3.min.js",
        "https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.js": f"/static/vendor/pixi-{p['pixi']}/pixi.js",
        f"https://cdnjs.cloudflare.com/ajax/libs/mermaid/{p['mermaid']}/mermaid.esm.min.mjs":
            f"/static/vendor/mermaid-{p['mermaid']}/mermaid.esm.min.mjs",
    }


def code_patches(p):
    """Loader-shape patches that do more than swap a URL, keyed on the exact minified call so
    an upstream change fails loudly instead of half-applying.
    pixi.js generates shader/uniform code with `new Function` and refuses to run under a policy
    without 'unsafe-eval' -- unless its own `unsafe-eval` add-on is loaded AFTER it, which swaps
    in eval-free implementations. Chain that load onto pixi's, using the plugin's own loader."""
    local = f"/static/vendor/pixi-{p['pixi']}"
    return {
        'e("https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.js")':
            f'e("{local}/pixi.js").then(function(){{return e("{local}/unsafe-eval.js")}})',
    }


def extra_vendored(p):
    """Files build.sh must vendor beyond the direct URL swaps."""
    return [f"/static/vendor/pixi-{p['pixi']}/unsafe-eval.js"]


# Exact strings deleted from the OUTPUT (HTML is not content-hashed). A removal that finds
# nothing is not a failure -- upstream may stop emitting it; the survivor scan is the check.
REMOVALS = [
    '<link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin="anonymous"/>',
]

# Known-dormant references inside a vendored library: (output-relative path prefix, line
# pattern). pixi.js carries CDN URLs for its Basis/KTX compressed-texture transcoders; they
# are fetched only when such a texture is decoded, which the graph never does -- and the
# policy's connect-src/script-src 'self' would refuse the fetch anyway. Constants, not requests.
EXEMPT = [
    ("static/vendor/pixi-", re.compile(r"cdn\.jsdelivr\.net/npm/pixi\.js/transcoders/(?:basis|ktx)/")),
]

# Any of these surviving anywhere in the output is a failure, matched or not.
FORBIDDEN_HOSTS = re.compile(
    r"https?://(?:[a-z0-9-]+\.)*(?:cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|"
    r"esm\.sh|cdn\.skypack\.dev|fonts\.googleapis\.com|fonts\.gstatic\.com|"
    r"ajax\.googleapis\.com|code\.jquery\.com)(?![\w.-])",
    re.IGNORECASE,
)
TEXT_EXT = {".js", ".mjs", ".cjs", ".html", ".htm", ".css", ".xml", ".json", ".svg", ".txt", ".map"}
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


def survivors(root):
    """[(relpath, lineno, host)] for every forbidden third-party URL left under root."""
    found = []
    for path in text_files(root):
        rel = os.path.relpath(path, root)
        exempt = [pat for (prefix, pat) in EXEMPT if rel.startswith(prefix)]
        with open(path, "r", encoding="utf-8", errors="surrogateescape") as f:
            for i, line in enumerate(f, 1):
                if not FORBIDDEN_HOSTS.search(line):
                    continue
                if any(pat.search(line) for pat in exempt):
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
    # Loader-shape patches first: they contain the bare URLs the second pass would otherwise eat.
    shaped = replace_all(root, code_patches(p))
    for call, n in shaped.items():
        if n == 0:
            say(f"FAIL: expected loader call not found in any plugin source (upstream loader changed?): {call}")
            fails += 1
        else:
            say(f"patched {n:3d}x  {call[:60]}... -> chained unsafe-eval loader")
    counts = replace_all(root, rewrites(p))
    for url, n in counts.items():
        # A URL consumed entirely by a loader-shape patch above still counts as found.
        n += sum(k for c, k in shaped.items() if url in c)
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
    for local in list(rewrites(p).values()) + extra_vendored(p):
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

    p = {"d3": "7.9.0", "pixi": "8.20.1", "mermaid": "11.4.0"}
    R = rewrites(p)
    tmp = tempfile.mkdtemp(prefix="no-third-party-selftest-")
    try:
        # --- patch: a fake upstream checkout with one plugin source naming all three URLs
        work = os.path.join(tmp, "work")
        plug = os.path.join(work, PLUGIN_ROOT, "graph", "dist")
        os.makedirs(plug)
        pixi_cdn = "https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.js"
        write(os.path.join(plug, "index.js"),
              "Promise.all([" + ",".join(f'e("{u}")' for u in R) + "])")
        write(os.path.join(plug, "index.js.map"), " ".join(R))  # bare URLs, as a source map carries them
        ok(patch(work, p, quiet=True) == 0, "patch succeeds when every URL is present")
        s = read(os.path.join(plug, "index.js"))
        ok(all(u not in s for u in R) and all(v in s for v in R.values()), "patch rewrote every URL")
        ok(f'e("{R[pixi_cdn]}").then(function(){{return e("{extra_vendored(p)[0]}")}})' in s,
           "pixi load is chained with its unsafe-eval add-on")
        ok(all(u not in read(os.path.join(plug, "index.js.map")) for u in R), "bare URLs in the map rewritten too")
        ok(patch(work, p, quiet=True) == 1, "a second patch finds nothing and FAILS (loader changed)")
        ok(patch(os.path.join(tmp, "nowhere"), p, quiet=True) == 2, "no node_modules -> CANNOT EVALUATE")

        # --- check: a fake output with the vendored targets, a preconnect, absolute fonts,
        #     and one page with src'd / real / empty inline scripts
        out = os.path.join(tmp, "out")
        os.makedirs(os.path.join(out, "static", "scripts"))
        os.makedirs(os.path.join(out, "static", "fonts"))
        for v in list(R.values()) + extra_vendored(p):
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
        # Negative 2: a CDN URL still in the output (patch not run) must fail.
        write(os.path.join(out, "static", "scripts", "s.js"), " ".join(R))
        ok(check(out, inc, p, quiet=True) == 1, "unpatched CDN URL in output fails")
        write(os.path.join(out, "static", "scripts", "s.js"), " ".join(R.values()))
        # Negative 3: a vendored target missing must fail.
        d3 = os.path.join(out, R["https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"].lstrip("/"))
        os.remove(d3)
        ok(check(out, inc, p, quiet=True) == 1, "missing vendored file fails")
        write(d3, "// vendored\n")
        # Exemption is PATH-scoped: pixi's transcoder URL is fine inside pixi's own dir, a failure elsewhere.
        tx = 'x = "https://cdn.jsdelivr.net/npm/pixi.js/transcoders/basis/basis_transcoder.js"'
        pixi = os.path.join(out, R["https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.js"].lstrip("/"))
        write(pixi, "// vendored\n" + tx + "\n")
        ok(check(out, inc, p, quiet=True) == 0, "dormant transcoder URL inside pixi is exempt")
        write(os.path.join(out, "static", "scripts", "other.js"), tx + "\n")
        ok(check(out, inc, p, quiet=True) == 1 and survivors(out)[0][0] == os.path.join("static", "scripts", "other.js"),
           "the same URL outside pixi fails")
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
