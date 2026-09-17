// Other Memory -- overlaid onto the upstream checkout as its quartz.ts by site/quartz/build.sh,
// the same way quartz.config.yaml is. Upstream's own file is the last three statements (five
// lines at the pin); `diff` against it after a QUARTZ_SHA bump, as for the config.
//
// The one addition: the social card's layout. The og-image plugin's `imageStructure` option is a
// function, which YAML cannot carry, so it goes through the option-override registry upstream
// documents for callback-valued options ("must be placed before loadQuartzConfig()"). The key is
// the plugin's source string as written in quartz.config.yaml; overrides win over YAML options
// at instantiation. The card itself lives with the rest of the disclosure plugin
// (site/quartz/plugins/disclosure/src/card.tsx, journey-site#20); the build bundles this file
// and its relative imports, so the card needs no separate build step.
import { componentRegistry } from "./quartz/components/registry"
import { disclosureCard } from "./site-plugins/disclosure/src/card"
import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"

componentRegistry.setOptionOverrides("@quartz-community/og-image", { imageStructure: disclosureCard })

const config = await loadQuartzConfig()
export default config
export const layout = await loadQuartzLayout()
