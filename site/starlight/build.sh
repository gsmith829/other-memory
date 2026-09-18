#!/usr/bin/env bash
# Build Awakening (Starlight) from the same content/ tree Other Memory is built from -- journey-site#50.
#
#   site/starlight/build.sh            -> site/starlight/dist/   (gitignored)
#   SITE_URL=https://awakening.<zone>   the public name; canonical URLs, og:url, the feed's links
#                                        and the sitemap are built against it (default: a placeholder)
#
# Runs in three places and must mean the same thing in all of them: a clone (this script), the
# forge's runner (.forgejo/workflows/build.yml, then image.sh for the private origin) and Cloudflare
# Pages (which runs exactly this command against the promoted public tree). So: a pinned toolchain
# (package-lock.json, `npm ci`), the content assembled into a scratch dir and never edited in place,
# a strict build (a broken internal link fails it, so does an alert that did not become an aside),
# and the two post-build checks that turn "it built" into "it is the site we meant to publish":
#   no-third-party.py   nothing in the output is fetched from anyone else's origin; then the CSP
#   check-emitted.py    every page we meant to publish is there, nothing else is, and the disclosure
#                       reached every surface (byline, descriptions, feed, card)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HERE="$ROOT/site/starlight"
DOCS="$HERE/src/content/docs"; FONTS="$HERE/src/fonts"; OUT="$HERE/dist"
export SITE_URL="${SITE_URL:-https://awakening.example}"
SITE_HOST="${SITE_URL#https://}"; SITE_HOST="${SITE_HOST#http://}"; SITE_HOST="${SITE_HOST%%/*}"

# The card's fonts (src/pages/og/[...route].ts): two IBM Plex TTFs (OFL) at ONE pinned tag of
# IBM/plex, verified by sha256 -- the pin is the whole of the supply chain here, the same way
# QUARTZ_SHA is for the garden. astro-og-canvas would otherwise fetch Noto Sans from fontsource
# at build time, unpinned. Fetched once per clone into a gitignored dir; a wrong hash refuses.
PLEX_TAG="v6.4.0"
PLEX="IBMPlexSerif-Medium.ttf IBM-Plex-Serif/fonts/complete/ttf/IBMPlexSerif-Medium.ttf 6b5bfe2b755d256b2bd7ff2be78f1df1931f4a3aad3c6e413284410dfe5b91f7
IBMPlexSans-Regular.ttf IBM-Plex-Sans/fonts/complete/ttf/IBMPlexSans-Regular.ttf 975dcda37d80f038dcd143c22e33ca2d97a0cc5a929aace1c749153b0fe1afa5"

echo "== portable-markdown lint (scripts/portable.py --lint): the subset both generators render"
python3 "$ROOT/scripts/portable.py" --lint "$ROOT/content"

echo "== toolchain (npm ci, package-lock.json)"
# --legacy-peer-deps: satteri-resolve-markdown-links 0.1.2 declares satteri ^0.7||^0.8; Astro 7.3
# ships 0.10.x. The resolver is kept (astro.config.mjs says why); this flag is the cost, recorded.
(cd "$HERE" && npm ci --no-audit --no-fund --loglevel=error --legacy-peer-deps)

sha256() { if command -v sha256sum >/dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1; }
echo "== fonts: IBM Plex $PLEX_TAG, sha256-verified"
mkdir -p "$FONTS"
while read -r name path want; do
  if [ ! -s "$FONTS/$name" ] || [ "$(sha256 "$FONTS/$name")" != "$want" ]; then
    curl -sSfL --retry 3 -o "$FONTS/$name" "https://raw.githubusercontent.com/IBM/plex/$PLEX_TAG/$path"
  fi
  [ "$(sha256 "$FONTS/$name")" = "$want" ] || { echo "FAIL: $name does not match the pinned sha256 (tag $PLEX_TAG)" >&2; exit 1; }
done <<<"$PLEX"

echo "== assemble docs: content/awakening/ + content/colophon.md -> $DOCS (the garden is Other Memory's)"
rm -rf "$DOCS"; mkdir -p "$DOCS/awakening"
[ -f "$ROOT/content/awakening/index.md" ] || { echo "FAIL: content/awakening/index.md (the front door) is missing" >&2; exit 1; }
[ -f "$ROOT/content/colophon.md" ] || { echo "FAIL: content/colophon.md (the byline's target) is missing" >&2; exit 1; }
cp -R "$ROOT/content/awakening/." "$DOCS/awakening/"
cp "$ROOT/content/colophon.md" "$DOCS/colophon.md"

echo "== build (strict: links validated, an unresolved link refused) -> $OUT  site=$SITE_URL"
rm -rf "$OUT"
# Astro phones home at build time unless told not to; this build talks to nobody but the registry and the font pin.
(cd "$HERE" && ASTRO_TELEMETRY_DISABLED=1 npx astro build)
[ -s "$OUT/awakening/index.html" ] || { echo "FAIL: no awakening/index.html in $OUT" >&2; exit 1; }
unresolved=$(grep -rlE 'class="[^"]*\bnew\b[^"]*"' "$OUT" --include='*.html' || true)
if [ -n "$unresolved" ]; then echo "FAIL: unresolved link(s) (class \"new\") in:"; echo "$unresolved"; exit 1; fi

echo "== check: no third-party origin in the output; write the CSP (site/starlight/no-third-party.py)"
python3 "$HERE/no-third-party.py" --selftest >/dev/null
python3 "$HERE/no-third-party.py" "$OUT" --site-host "$SITE_HOST" --csp-inc "$HERE/csp.inc"

echo "== check: every page emitted, nothing else, the disclosure on every surface (site/starlight/check-emitted.py)"
python3 "$HERE/check-emitted.py" --selftest >/dev/null
python3 "$HERE/check-emitted.py" "$ROOT/content" "$OUT"

pages=$(find "$OUT" -name '*.html' | wc -l | tr -d ' ')
echo "== ok: $pages html pages in $OUT"
