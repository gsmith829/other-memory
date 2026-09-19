/**
 * Contents -- the plugin half is empty on purpose. The loader instantiates a plugin once per
 * category it declares and needs a transformer to carry one of textTransform / markdownPlugins /
 * htmlPlugins, or it skips the plugin with a warning and exit 0 (measured on the identity plugin,
 * 2026-09-17). The component is ./components; the topic list and the build-failing check live
 * there, next to what renders them.
 */
import type { QuartzTransformerPlugin } from "@quartz-community/types"

const Contents: QuartzTransformerPlugin = () => ({
  name: "Contents",
  htmlPlugins() {
    return []
  },
})

export default Contents
