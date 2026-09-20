/**
 * Related -- the transformer half (journey-site#133; Joe, 2026-09-20).
 *
 * A garden page's `related:` is a list of other garden pages' slugs, TOLD in the tray brief's
 * `pieces:` beside `topic:` and copied into the frontmatter, never derived: the chronicler cannot
 * see the garden, by design, so she cannot write wikilinks, and nobody else's links belong in her
 * prose (D6). The relation is data about the page. This transformer APPENDS the slugs to
 * `file.data.links`: that one list is what the content index emits, what the graph draws its edges
 * from, and what upstream's Backlinks reads -- there is no second channel (measured at the pinned
 * upstream: graph, content-index and backlinks all read `.links`). So the graph gets real edges,
 * and the foot component in ./components subtracts these from the backlinks it lists, or a
 * relation would be labelled "Backlink" -- which is why upstream's Backlinks is off and this
 * plugin renders both.
 *
 * It does NOT validate. The gate -- unknown slug, self, duplicate, not a list, one way only -- is
 * the contents component's `checkRelated` (#134/#137, Bilby), the one place that already reads
 * every garden page; a second gate here would be two mechanisms for one field, one masking the
 * other. This reads leniently (strings only) and lets that gate name the file.
 *
 * Runs after crawl-links (order 60), which ASSIGNS `data.links` from the body's anchors; this
 * appends, so both survive.
 */
import type { QuartzTransformerPlugin } from "@quartz-community/types"
import type { FullSlug, SimpleSlug } from "@quartz-community/types"
import { simplifySlug } from "@quartz-community/utils/path"

export interface RelatedOptions {
  /** Pages under this folder are the garden; `related:` slugs are relative to it. */
  folder: string
}

const defaults: RelatedOptions = { folder: "garden" }

/** The frontmatter value as bare slugs, read leniently: validation is the contents gate's (#137). */
export function relatedOf(frontmatter: Record<string, unknown> | undefined): string[] {
  const raw = frontmatter?.related
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean)
}

const Related: QuartzTransformerPlugin<Partial<RelatedOptions>> = (userOpts) => {
  const opts = { ...defaults, ...userOpts }
  return {
    name: "Related",
    htmlPlugins() {
      return [
        () => (_tree: unknown, file: { data: Record<string, any> }) => {
          const slug = file.data.slug as FullSlug | undefined
          if (!slug || !slug.startsWith(`${opts.folder}/`)) return
          const links = new Set<SimpleSlug>((file.data.links ?? []) as SimpleSlug[])
          for (const bare of relatedOf(file.data.frontmatter)) links.add(simplifySlug(`${opts.folder}/${bare}` as FullSlug))
          file.data.links = [...links]
        },
      ]
    },
  }
}

export default Related
