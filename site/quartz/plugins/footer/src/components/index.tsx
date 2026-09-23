/**
 * Footer -- the garden's own (journey-site cold read 5, 2026-09-23; Joe's word).
 *
 * Upstream's footer renders "Created with Quartz v5.0.0 © 2026" above the links, and its options
 * carry only `links` -- the credit is a hardcoded i18n string. A cold reader's single biggest ask
 * for this site was to remove it: "the colophon already does that job better, and the stock line is
 * the one element that says 'theme'." The colophon does: it names Quartz and Starlight with links,
 * in a sentence about why two generators render the same markdown. So the credit is not lost, it is
 * said once, in the place that explains it.
 *
 * Not hidden with CSS: text hidden in the DOM is still read aloud and still indexed, which is a
 * worse answer than not emitting it. This component emits the links and nothing else; the
 * identity stylesheet already styles `#quartz-body > footer`, and that is unchanged.
 */
import type { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "@quartz-community/types"
import { classNames } from "@quartz-community/utils/lang"
import { resolveRelative, simplifySlug } from "@quartz-community/utils/path"
import type { FullSlug, SimpleSlug } from "@quartz-community/types"

export interface FooterOptions {
  /** label -> slug, rendered in order. */
  links: Record<string, string>
}

const defaults: FooterOptions = { links: { Colophon: "colophon" } }

export const Footer: QuartzComponentConstructor<Partial<FooterOptions>> = (userOpts) => {
  const opts = { ...defaults, ...userOpts }
  const Component: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
    const here = fileData.slug as FullSlug
    return (
      <footer class={classNames(displayClass)}>
        <ul>
          {Object.entries(opts.links).map(([label, slug]) => (
            <li>
              <a href={resolveRelative(here, simplifySlug(slug as FullSlug) as SimpleSlug)}>{label}</a>
            </li>
          ))}
        </ul>
      </footer>
    )
  }
  return Component
}

export default { Footer }
