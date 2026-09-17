/**
 * Disclosure -- the AI-authorship disclosure on the surfaces a reader meets BEFORE the footer.
 * journey-site#20 (feed + OpenGraph, this file) and #21 (the page byline, ./components).
 *
 * Feeds and social cards never render the footer, so a footer-only colophon silently fails on
 * exactly the surfaces most people see first. This transformer runs AFTER
 * @quartz-community/description (order 70 < 75 -- the manifest's `dependencies` makes the
 * loader refuse the opposite order) and appends the colophon's short version, verbatim, to the
 * two fields those surfaces read. Measured in upstream Quartz at the pinned SHA, 2026-09-16,
 * by reading quartz/components/Head.tsx and the content-index / og-image dists -- and then by
 * building: the first draft appended to frontmatter.description as well, which nothing reads:
 *
 *   file.data.description          -> content-index: the RSS <item><description>.
 *   frontmatter.socialDescription  -> Head: og:description AND <meta name="description">; and
 *                                     og-image: the description it hands the card. Both read
 *                                     socialDescription FIRST, then frontmatter.description,
 *                                     then file.data.description -- so this one field is the
 *                                     whole OpenGraph text surface, and frontmatter.description
 *                                     is never read once it is set (left untouched here).
 *
 * Both get the page's own summary FIRST and the full short version after: feed readers show
 * an item whole, search snippets keep the page's own words, and the platforms that still show
 * og:description (Slack, Discord, Mastodon) fit the summary plus the disclosure's first
 * sentences. The surface that would clip a trailing disclosure -- the social-card image, the
 * only thing LinkedIn/X/iMessage render -- does not read this text at all: ./card.tsx draws
 * the disclosure as its own fixed line, from what this transformer leaves on
 * `file.data.disclosure` (the untouched summary, the text, the lead).
 *
 * note-properties (order 5) snapshots the frontmatter before this runs, so the visible
 * properties panel keeps the page's own description; search previews use the body text, not
 * the description; folder/tag listings read a description only for an EMPTY index page.
 * Nothing else reads these fields (grep over quartz/ and every @quartz-community dist at the
 * pin).
 *
 * The text is NOT in this file. It is the `disclosure` option in site/quartz/quartz.config.yaml,
 * and on the colophon page this plugin asserts that text is a verbatim substring of the page
 * (whitespace-normalised, HTML-unescaped) and FAILS THE BUILD otherwise: the config and the
 * colophon's "short version" callout cannot drift apart silently. A missing option fails the
 * build too -- a site whose feed and cards say nothing is not a site to publish.
 *
 * Built by site/quartz/build.sh in the upstream overlay (see there for why a local plugin
 * cannot live at its own real path); no build output is committed.
 */
import type { QuartzTransformerPlugin } from "@quartz-community/types"
import { unescapeHTML } from "@quartz-community/utils/escape"
import "./types"

export interface Options {
  /** The colophon's short version, verbatim, as plain text. Required. */
  disclosure: string
  /** The social card's own disclosure line (./card.tsx): a verbatim PREFIX of `disclosure` that fits three lines of 26px. Required. */
  lead: string
  /** Slug of the page that must contain `disclosure` verbatim; the byline links here. */
  colophonSlug: string
  /** Between a page's own description and the disclosure. */
  separator: string
}

const defaults: Pick<Options, "colophonSlug" | "separator"> = {
  colophonSlug: "colophon",
  separator: " — ",
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim()

/** `own` first, the disclosure after. */
function withDisclosure(own: string | undefined, text: string, sep: string): string {
  const o = own ? own.trim() : ""
  return o ? `${o}${sep}${text}` : text
}

const Disclosure: QuartzTransformerPlugin<Partial<Options>> = (userOpts) => {
  const opts = { ...defaults, ...userOpts }
  const disclosure = opts.disclosure ? norm(opts.disclosure) : ""
  const lead = opts.lead ? norm(opts.lead) : ""
  // Validated here but THROWN from inside the per-file hook, not from this factory: Quartz's
  // config loader catches a factory error, prints "Failed to instantiate plugin", drops the
  // plugin and exits 0 -- a site with no disclosure at all builds green (measured at the pin,
  // 2026-09-16). A throw inside the hook is "Failed to process html" and exit 1.
  const problem = !disclosure
    ? "disclosure: the `disclosure` option is required (site/quartz/quartz.config.yaml); refusing to build a site whose feed and cards carry no disclosure"
    : !lead || !disclosure.startsWith(lead)
      ? "disclosure: `lead` must be a verbatim prefix of `disclosure` (it is what the social card shows); fix quartz.config.yaml"
      : null

  return {
    name: "Disclosure",
    htmlPlugins() {
      return [
        () => (_tree, file) => {
          if (problem) throw new Error(problem)
          const fm = file.data.frontmatter
          const own = fm?.description ?? file.data.description

          if (file.data.slug === opts.colophonSlug) {
            const page = norm(unescapeHTML(file.data.text ?? ""))
            if (!page.includes(disclosure)) {
              throw new Error(
                `disclosure: the configured text is not in ${file.data.filePath} verbatim -- the colophon's short version and quartz.config.yaml have drifted apart; make them agree before building`,
              )
            }
          }

          file.data.disclosure = { own: (own ?? "").trim(), text: disclosure, lead }
          file.data.description = withDisclosure(file.data.description, disclosure, opts.separator)
          if (fm) {
            fm.socialDescription = withDisclosure(fm.socialDescription ?? own, disclosure, opts.separator)
          }
        },
      ]
    },
  }
}

export default Disclosure
