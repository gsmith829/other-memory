/**
 * Theme -- the plugin half is empty on purpose (the loader needs a transformer carrying one of
 * textTransform / markdownPlugins / htmlPlugins or it skips the plugin; measured 2026-09-17).
 */
import type { QuartzTransformerPlugin } from "@quartz-community/types"

const Theme: QuartzTransformerPlugin = () => ({
  name: "Theme",
  htmlPlugins() {
    return []
  },
})

export default Theme
