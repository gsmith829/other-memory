#!/usr/bin/env bash
# Build Other Memory (Quartz) from content/ into an output directory. journey-site#5.
#
#   site/quartz/build.sh [output-dir]        default: <repo>/public
#
# Upstream Quartz is NOT vendored in this repo. This script fetches it at ONE pinned commit,
# overlays site/quartz/quartz.config.yaml, and builds. The same script is the build step
# everywhere the site is built -- the Dockerfile next to it, CI on bijaz, Cloudflare Pages --
# so "it built here" means the same thing in all three places.
#
# Upgrading Quartz = change QUARTZ_SHA (and the matching line in .leak-gate-allow, which is
# the deliberate act -- a 40-hex string trips the gate on purpose), rebuild, diff
# quartz.config.yaml against upstream's quartz.config.default.yaml at the new commit, review.
#
# Why a SHA and not a tag: upstream's only v5 tag (v5.0.0) marks the FIRST v5 commit,
# 2026-03-14, six months behind the branch it names, and upstream cuts no GitHub releases
# (last one 2023). The v5 branch head is what the docs site and `npx quartz create` ship.
# Measured 2026-09-15 before pinning.
set -euo pipefail

QUARTZ_REPO="https://github.com/jackyzha0/quartz.git"
QUARTZ_SHA="3dff48b5df6d84c9544a5ae19c8f2cbb01dc44e5" # v5 branch, 2026-09-15 02:52 +0200

# Runtime libraries upstream's plugins would otherwise load from public CDNs (journey-site#34).
# Vendored from the SAME npm packages jsdelivr/cdnjs serve, so the bytes are what the CDN would
# have sent -- minus the third party at read time. no-third-party.py patches the plugin sources
# BEFORE the build (so Quartz's content-hashed script names change with the content) and fails
# the build AFTER it if any CDN reference survives in the output.
#   d3 / pixi.js  : graph view fetches "d3@7" and "pixi.js@8" (floating majors) -- pinned exact here
#   mermaid       : obsidian-flavored-markdown imports EXACTLY this version by URL; when the plugin
#                   bumps it the patch step fails loudly and this pin moves with it
export VENDOR_D3="7.9.0"
export VENDOR_PIXI="8.20.1"
export VENDOR_MERMAID="11.4.0"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK="${QUARTZ_WORKDIR:-$ROOT/.quartz-upstream}" # gitignored; persists locally so rebuilds are fast
OUT="${1:-$ROOT/public}"
case "$OUT" in /*) ;; *) OUT="$PWD/$OUT" ;; esac

echo "== upstream Quartz @ ${QUARTZ_SHA:0:7} -> $WORK"
if [ ! -d "$WORK/.git" ]; then
  git init -q "$WORK"
  git -C "$WORK" remote add origin "$QUARTZ_REPO"
fi
if [ "$(git -C "$WORK" rev-parse HEAD 2>/dev/null || true)" != "$QUARTZ_SHA" ]; then
  git -C "$WORK" fetch -q --depth 1 origin "$QUARTZ_SHA"
  git -C "$WORK" checkout -q --detach FETCH_HEAD
fi
# The pin is the whole point; a checkout that is not at it must not build.
[ "$(git -C "$WORK" rev-parse HEAD)" = "$QUARTZ_SHA" ] || { echo "FAIL: upstream checkout is not at $QUARTZ_SHA" >&2; exit 2; }

echo "== dependencies (upstream package-lock.json; the plugins are npm packages pinned there)"
(cd "$WORK" && npm ci --no-audit --no-fund --loglevel=error)

echo "== point the plugin sources at the vendored libraries (before the build, on purpose)"
python3 "$ROOT/site/quartz/no-third-party.py" patch "$WORK"

echo "== overlay site config"
cp "$ROOT/site/quartz/quartz.config.yaml" "$WORK/quartz.config.yaml"
# Upstream ships sample content of its own; the build reads ONLY $ROOT/content via -d,
# but make the mistake impossible rather than merely avoided.
rm -rf "$WORK/content"

echo "== build $ROOT/content -> $OUT"
(cd "$WORK" && npx quartz build -d "$ROOT/content" -o "$OUT")

# A build that "succeeds" with no front door is not a success.
[ -s "$OUT/index.html" ] || { echo "FAIL: no index.html in $OUT" >&2; exit 1; }

echo "== vendor runtime libraries (d3 $VENDOR_D3, pixi.js $VENDOR_PIXI, mermaid $VENDOR_MERMAID)"
# Versioned directories: a bump changes the URL, so no immutable cache can serve an old copy.
VEND="$OUT/static/vendor"
PACK="$(mktemp -d)"
trap 'rm -rf "$PACK"' EXIT
(cd "$PACK" && npm pack --silent --loglevel=error "d3@$VENDOR_D3" "pixi.js@$VENDOR_PIXI" "mermaid@$VENDOR_MERMAID" >/dev/null)
mkdir -p "$VEND/d3-$VENDOR_D3" "$VEND/pixi-$VENDOR_PIXI" "$VEND/mermaid-$VENDOR_MERMAID" "$PACK/d3" "$PACK/pixi" "$PACK/mermaid"
tar -xzf "$PACK/d3-$VENDOR_D3.tgz"           -C "$PACK/d3"      package/dist/d3.min.js
tar -xzf "$PACK/pixi.js-$VENDOR_PIXI.tgz"    -C "$PACK/pixi"    package/dist/pixi.js package/dist/packages/unsafe-eval.js
tar -xzf "$PACK/mermaid-$VENDOR_MERMAID.tgz" -C "$PACK/mermaid" package/dist/mermaid.esm.min.mjs package/dist/chunks/mermaid.esm.min
cp "$PACK/d3/package/dist/d3.min.js"                "$VEND/d3-$VENDOR_D3/d3.min.js"
cp "$PACK/pixi/package/dist/pixi.js"                "$VEND/pixi-$VENDOR_PIXI/pixi.js"
cp "$PACK/pixi/package/dist/packages/unsafe-eval.js" "$VEND/pixi-$VENDOR_PIXI/unsafe-eval.js" # eval-free shader path; see no-third-party.py
cp "$PACK/mermaid/package/dist/mermaid.esm.min.mjs" "$VEND/mermaid-$VENDOR_MERMAID/mermaid.esm.min.mjs"
cp -R "$PACK/mermaid/package/dist/chunks"           "$VEND/mermaid-$VENDOR_MERMAID/chunks"

echo "== check: no third-party origin survives in the output; write the CSP"
CSP_INC="${CSP_INC:-$(dirname "$OUT")/csp.inc}"
python3 "$ROOT/site/quartz/no-third-party.py" check "$OUT" --csp-inc "$CSP_INC"

pages=$(find "$OUT" -name '*.html' | wc -l | tr -d ' ')
echo "== ok: $pages html pages in $OUT; nginx CSP include at $CSP_INC"
