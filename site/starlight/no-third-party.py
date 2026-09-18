#!/usr/bin/env python3
"""No third-party origin in the built Awakening site -- prove after the build, then write the CSP
the clean output makes possible. journey-site#50 (promoted from the #6 bake-off's F2 check; the
same standard site/quartz/no-third-party.py enforces on Other Memory). Stdlib only.

    no-third-party.py <output-dir> --site-host HOST [--csp-inc PATH] [--exempt PATH-PREFIX:WHY ...]
                                                            exit 0 clean, 1 hits, 2 cannot evaluate
    no-third-party.py --selftest
An exemption is printed every time it fires, with its reason, so it can never go quiet.

Two tests:
  1. LOAD positions -- anything a browser would fetch at read time: <script src>, <link href> (other
     than canonical/alternate/sitemap/license relations, which are pointers, not loads), <img>/<iframe>/
     <video>/<audio>/<source> src, CSS @import and url(), inline style url(). An external origin here
     is a third party executing or observing the read.
  2. Known CDN / font hosts ANYWHERE in the output (a string in a script is a load waiting to happen).
A URL that merely appears in text -- a translator credit in a library comment, a hyperlink in prose,
an XML namespace, a parsing base -- is not a load and is not counted.

Then, on a clean tree: the Content-Security-Policy. `script-src 'self'` plus the sha256 of every
inline <script> body the output carries (Starlight's theme/sidebar-state scripts are inline), and
'wasm-unsafe-eval' because Starlight's search (Pagefind) instantiates WebAssembly -- that is the one
relaxation, and it permits wasm from 'self' only, not eval. Written as `_headers` in the output for
Cloudflare Pages and as an nginx `add_header` include (--csp-inc) for the private origin's image.
"""
import base64, hashlib, os, re, sys, tempfile

TEXT = {".html", ".htm", ".css", ".js", ".mjs", ".xml", ".svg"}
URL = r"https?://([A-Za-z0-9.-]+)"
HTML_LOADS = [
    re.compile(r"<script\b[^>]*\ssrc\s*=\s*[\"']" + URL, re.I),
    re.compile(r"<(?:img|iframe|video|audio|source|embed)\b[^>]*\ssrc\s*=\s*[\"']" + URL, re.I),
    re.compile(r"<link\b(?![^>]*\brel\s*=\s*[\"'](?:canonical|alternate|sitemap|license|me|author)\b)[^>]*\shref\s*=\s*[\"']" + URL, re.I),
]
# CSS only (html carries inline <style>): JS's `new URL(...)` is a parser, not a fetch, so .js is excluded here.
CSS_LOADS = [
    re.compile(r"@import\s+(?:url\()?[\"']?" + URL, re.I),
    re.compile(r"\burl\(\s*[\"']?" + URL),
]
CDN = re.compile(r"https?://(?:[a-z0-9-]+\.)*(?:cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|esm\.sh|"
                 r"cdn\.skypack\.dev|fonts\.googleapis\.com|fonts\.gstatic\.com|ajax\.googleapis\.com|"
                 r"code\.jquery\.com|use\.typekit\.net|fonts\.bunny\.net)(?![\w.-])", re.I)
ALWAYS_OK = {"www.w3.org"}  # xmlns, never fetched
INLINE_SCRIPT = re.compile(r"<script\b([^>]*)>(.*?)</script>", re.S | re.I)
SRC_ATTR = re.compile(r"\bsrc\s*=", re.I)
HARDENING = [
    ("X-Content-Type-Options", "nosniff"),
    ("X-Frame-Options", "DENY"),
    ("Referrer-Policy", "strict-origin-when-cross-origin"),
    ("Permissions-Policy", "camera=(), microphone=(), geolocation=()"),
]


def inline_script_hashes(root):
    """sha256 (base64) of every distinct inline <script> body in the HTML output."""
    hashes = {}
    for d, _, names in os.walk(root):
        for n in names:
            if not n.lower().endswith((".html", ".htm")):
                continue
            s = open(os.path.join(d, n), encoding="utf-8", errors="surrogateescape").read()
            for m in INLINE_SCRIPT.finditer(s):
                attrs, body = m.group(1), m.group(2)
                if SRC_ATTR.search(attrs) or not body.strip():
                    continue
                # The browser hashes the exact bytes between the tags -- no strip, no normalize.
                digest = hashlib.sha256(body.encode("utf-8", "surrogateescape")).digest()
                hashes[base64.b64encode(digest).decode()] = body[:60]
    return hashes


def build_csp(hashes):
    script_src = " ".join(["'self'", "'wasm-unsafe-eval'"] + [f"'sha256-{h}'" for h in sorted(hashes)])
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
    """Cloudflare Pages `_headers`: the same policy and hardening nginx serves on korba. Long-lived
    caching only where the NAME changes with the content: Astro's _astro/ assets are content-hashed."""
    lines = ["/*", f"  Content-Security-Policy: {csp}"]
    lines += [f"  {k}: {v}" for k, v in HARDENING]
    lines += ["", "/_astro/*", "  Cache-Control: public, max-age=2592000, immutable", ""]
    with open(os.path.join(root, "_headers"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def write_csp_inc(path, csp):
    with open(path, "w", encoding="utf-8") as f:
        f.write("# generated by site/starlight/no-third-party.py -- included inside nginx's server block\n"
                f'add_header Content-Security-Policy "{csp}" always;\n')


def scan(root, site_host, exempt=()):
    hits, files, exempted = [], 0, []
    for d, _, names in os.walk(root):
        for n in names:
            if os.path.splitext(n)[1].lower() not in TEXT:
                continue
            p = os.path.join(d, n); files += 1
            s = open(p, encoding="utf-8", errors="surrogateescape").read()
            rel = os.path.relpath(p, root)
            ex = next((why for prefix, why in exempt if rel.startswith(prefix)), None)
            ext = os.path.splitext(n)[1].lower()
            rxs = (HTML_LOADS + CSS_LOADS) if ext in (".html", ".htm", ".svg") else CSS_LOADS if ext == ".css" else []
            for rx in rxs:
                for m in rx.finditer(s):
                    host = m.group(1).lower()
                    if host != site_host and host not in ALWAYS_OK:
                        (exempted if ex else hits).append((rel, "load", host, ex))
            for m in CDN.finditer(s):
                (exempted if ex else hits).append((rel, "cdn-string", m.group(0), ex))
    return files, hits, exempted


def main(argv):
    if argv[:1] == ["--selftest"]:
        return selftest()
    if not argv:
        print(__doc__); return 2
    root, host, csp_inc = argv[0], None, None
    if "--site-host" in argv:
        host = argv[argv.index("--site-host") + 1]
    if "--csp-inc" in argv:
        csp_inc = argv[argv.index("--csp-inc") + 1]
    if not host:
        print("CANNOT EVALUATE: --site-host is required (the one origin that is not a third party)"); return 2
    exempt = [tuple(argv[i + 1].split(":", 1)) for i, a in enumerate(argv) if a == "--exempt"]
    if not os.path.isdir(root):
        print(f"CANNOT EVALUATE: not a directory: {root}"); return 2
    files, hits, exempted = scan(root, host, exempt)
    if files == 0:
        print(f"CANNOT EVALUATE: no text files under {root}"); return 2
    for rel, kind, what, why in sorted(set(exempted)):
        print(f"exempt: {kind}: {rel}: {what} -- {why}")
    for rel, kind, what, _ in sorted(set(hits)):
        print(f"FAIL: {kind}: {rel}: {what}")
    print(f"no-third-party: inspected {files} files, {len(hits)} third-party load(s), {len(exempted)} exempted")
    if hits:
        return 1
    hashes = inline_script_hashes(root)
    csp = build_csp(hashes)
    write_headers(root, csp)
    if csp_inc:
        write_csp_inc(csp_inc, csp)
    print(f"csp: script-src 'self' 'wasm-unsafe-eval' + {len(hashes)} inline script hash(es); wrote _headers" + (f" and {csp_inc}" if csp_inc else ""))
    return 0


def selftest():
    fails = 0
    tmp = tempfile.mkdtemp(prefix="ctp-")
    def w(rel, body):
        p = os.path.join(tmp, rel); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, "w").write(body)
    w("clean/index.html", '<link rel="canonical" href="https://wallach.example/"><link rel="stylesheet" href="/a.css">'
      '<script src="/x.js"></script><p>credit <a href="https://github.com/x">x</a> xmlns="http://www.w3.org/2000/svg"</p>')
    w("clean/a.css", 'body{background:url("data:image/svg+xml,x")} @import url("/b.css");')
    w("clean/p.js", 'new URL("https://example.com/base"); var t="Pablo <https://github.com/pv>"')
    n, h, _ = scan(os.path.join(tmp, "clean"), "wallach.example")
    fails += (n != 3 or h != []) and print("  FAIL clean tree flagged:", h) is None
    w("bad/index.html", '<script src="https://cdn.jsdelivr.net/npm/x"></script><link rel="stylesheet" href="https://fonts.googleapis.com/css2?f=Inter">')
    w("bad/a.css", '@font-face{src:url(https://fonts.gstatic.com/s/x.woff2)}')
    w("bad/q.js", 'import("https://unpkg.com/y")')
    n, h, _ = scan(os.path.join(tmp, "bad"), "wallach.example")
    kinds = sorted(set(k for _, k, _, _ in h))
    fails += (kinds != ["cdn-string", "load"] or len([1 for _, k, _, _ in h if k == "load"]) != 3) and print("  FAIL bad tree:", h) is None
    n, h, e = scan(os.path.join(tmp, "bad"), "wallach.example", [("a.css", "test")])
    fails += (len(e) != 2 or any(r == "a.css" for r, _, _, _ in h)) and print("  FAIL exemption:", h, e) is None
    fails += (main([os.path.join(tmp, "nope"), "--site-host", "x"]) != 2) and print("  FAIL missing dir must be exit 2") is None
    fails += (main([os.path.join(tmp, "clean")]) != 2) and print("  FAIL missing --site-host must be exit 2") is None
    # CSP: one inline script hashed by exact bytes; src'd and empty scripts get no hash; wasm allowed.
    w("csp/index.html", '<script>const a = 1;\n</script><script src="/x.js"></script><script></script>')
    inc = os.path.join(tmp, "csp.inc")
    rc = main([os.path.join(tmp, "csp"), "--site-host", "wallach.example", "--csp-inc", inc])
    hdr = open(os.path.join(tmp, "csp", "_headers")).read()
    expected = base64.b64encode(hashlib.sha256(b"const a = 1;\n").digest()).decode()
    fails += (rc != 0 or f"'sha256-{expected}'" not in hdr or hdr.count("sha256-") != 1) and print("  FAIL csp hashes:", hdr) is None
    fails += ("'wasm-unsafe-eval'" not in hdr or "frame-ancestors 'none'" not in hdr or "/_astro/*" not in hdr) and print("  FAIL csp shape") is None
    fails += (not open(inc).read().startswith("# generated") or "add_header Content-Security-Policy" not in open(inc).read()) and print("  FAIL csp.inc") is None
    rc = main([os.path.join(tmp, "bad"), "--site-host", "wallach.example"])
    fails += (rc != 1 or os.path.exists(os.path.join(tmp, "bad", "_headers"))) and print("  FAIL a dirty tree must get no _headers") is None
    print("selftest:", "ok" if not fails else f"{fails} failure(s)")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
