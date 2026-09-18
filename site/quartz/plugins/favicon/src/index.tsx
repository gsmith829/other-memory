/**
 * The garden's favicon (2026-09-18, dutchman): three points, joined -- memory reached by
 * association. Drawn as ../assets/favicon.svg; the PNGs are renders of it.
 *
 * Why an emitter, and why its own plugin: upstream's favicon plugin reads quartz/static/icon.png
 * from the CHECKOUT (not one of this repo's overlays) and sharps it into favicon.ico, and the
 * core Static emitter copies that same file to static/icon.png, which Head links as the icon.
 * So the mark travels here and this emitter writes it to the three places browsers look:
 *   static/icon.png     Head's <link rel="icon">, and what Safari uses
 *   favicon.ico         a 48px PNG under that name -- exactly what upstream's plugin writes
 *   static/favicon.svg  linked from additionalHead below; the SVG icon modern browsers prefer
 * Emitters run in PARALLEL (quartz/processors/emit.ts, Promise.all), so writing static/icon.png
 * would race Static's copy of upstream's. quartz.config.yaml keeps upstream's icon.png out of
 * that copy with ignorePatterns (the list Static honours) and disables upstream's favicon plugin;
 * both are noted there. This is not folded into the identity plugin because the loader
 * instantiates a multi-category plugin once per category and collects externalResources() from
 * every instance -- the stylesheet link would be emitted twice (measured).
 */
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { BuildCtx, FilePath, QuartzEmitterPlugin } from "@quartz-community/types"

// The plugin is copied whole into the checkout (build.sh: site-plugins/favicon), so the assets
// sit beside dist/ at build time; import.meta.url is dist/index.js.
const ASSETS = fileURLToPath(new URL("../assets/", import.meta.url))

const ICONS: Array<{ from: string; to: string }> = [
  { from: "icon.png", to: "static/icon.png" },
  { from: "favicon.ico", to: "favicon.ico" },
  { from: "favicon.svg", to: "static/favicon.svg" },
]

const Favicon: QuartzEmitterPlugin = () => ({
  name: "FaviconIdentity",
  externalResources() {
    return {
      css: [],
      js: [],
      additionalHead: [<link rel="icon" type="image/svg+xml" href="/static/favicon.svg" />],
    }
  },
  async *emit(ctx: BuildCtx) {
    for (const { from, to } of ICONS) {
      const dest = path.join(ctx.argv.output, to)
      await fs.mkdir(path.dirname(dest), { recursive: true })
      await fs.copyFile(path.join(ASSETS, from), dest)
      yield dest as FilePath
    }
  },
})

export default Favicon
