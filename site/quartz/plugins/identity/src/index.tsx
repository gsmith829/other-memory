/**
 * Identity -- Other Memory's visual identity, the part quartz.config.yaml cannot carry.
 *
 * The config's theme.colors / theme.typography become CSS custom properties site-wide and carry
 * the palette and the three typefaces. Everything else -- type scale, measure, rhythm, the front
 * door, the colophon, how the explorer / graph / backlinks recede -- needs real CSS. build.sh
 * overlays no stylesheet, and its esbuild step has no CSS loader, so a .scss file cannot ship.
 * A CSS *string* can: a transformer's externalResources() may return css with `inline: true`,
 * and the componentResources emitter writes it out as static/resource-style-<hash>.css,
 * UNLAYERED (so it wins over `@layer quartz-base` at any specificity), linked from <head> on
 * every page. Measured at the pinned upstream, 2026-09-17, in
 * quartz/plugins/emitters/componentResources.ts and quartz/components/renderPage.tsx; it is the
 * same path @quartz-themes/core uses to deliver a whole theme. Same origin, content-hashed name:
 * nothing for no-third-party.py to object to, and a change to the CSS changes the file name.
 *
 * This plugin transforms nothing. It exists to be asked for resources. The empty htmlPlugins()
 * is what makes the loader accept it as a transformer (config-loader.ts requires one of
 * textTransform / markdownPlugins / htmlPlugins on the instance, or it skips the plugin -- with a
 * warning and exit 0, so the site would build unstyled and green).
 */
import type { QuartzTransformerPlugin } from "@quartz-community/types"
import { css } from "./theme.css"

const Identity: QuartzTransformerPlugin = () => ({
  name: "Identity",
  htmlPlugins() {
    return []
  },
  externalResources() {
    return { css: [{ content: css, inline: true }], js: [] }
  },
})

export default Identity
