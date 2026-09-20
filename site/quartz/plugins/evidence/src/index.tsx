/**
 * Evidence -- the plugin half is empty on purpose (the loader needs a transformer to carry one of
 * textTransform / markdownPlugins / htmlPlugins or it skips the plugin; measured on the identity
 * plugin, 2026-09-17). The component is ./components. The GATE for the pair -- single non-empty
 * lines, within the measure, caption iff evidence -- is the contents component's `evidenceOf`
 * (#145, Bilby); this plugin reads leniently and lets that gate name the file, as `related` does.
 */
import type { QuartzTransformerPlugin } from "@quartz-community/types"

const Evidence: QuartzTransformerPlugin = () => ({
  name: "Evidence",
  htmlPlugins() {
    return []
  },
})

export default Evidence
