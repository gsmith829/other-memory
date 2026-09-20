/**
 * Related -- the foot of a garden page (journey-site#133; Joe, 2026-09-20).
 *
 *   See also      the page's told `related:` pages, titles in the serif, in the brief's order --
 *                 the reader's map, whether or not the graph survives the next cold read
 *   Linked from   the pages whose BODY links here: upstream's backlinks, minus the related ones.
 *                 One list (`links`) feeds the graph, the index and the backlinks, so a relation
 *                 fed in for the graph's sake would be labelled a backlink by upstream's panel;
 *                 this renders both, correctly labelled, and upstream's Backlinks is off.
 *
 * Under the <hr> upstream's layout already draws between the article and this slot (it is there
 * on every page, foot or no foot), so no border of its own. The headings are in the mono, the
 * machine's margin -- but that rule lives in the identity stylesheet, not here: Quartz emits a
 * component's css inside `@layer quartz-base`, and the fonts plugin's UNLAYERED `h1..h6 { serif }`
 * beats any layered rule whatever its specificity (measured 2026-09-20: the h2 rendered serif
 * with `.related h2 { mono }` present in the emitted component css). Layout stays here; type that
 * an unlayered sheet also sets goes in the unlayered sheet.
 * Renders nothing at all on a page with neither list -- no empty "No backlinks found".
 * Rows are not `a.internal` (the body's underline and popover), as the Contents rows are not.
 */
import type { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "@quartz-community/types"
import type { FullSlug, SimpleSlug } from "@quartz-community/types"
import { classNames } from "@quartz-community/utils/lang"
import { resolveRelative, simplifySlug } from "@quartz-community/utils/path"
import { relatedOf } from "../index"

export interface RelatedComponentOptions {
  folder: string
  seeAlso: string
  linkedFrom: string
}

const defaults: RelatedComponentOptions = { folder: "garden", seeAlso: "See also", linkedFrom: "Linked from" }

const css = `
.related {
  margin-top: -0.4rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 1.2rem 2.5rem;
}
.related h2 { margin: 0 0 0.45rem; }
.related ul { list-style: none; margin: 0; padding: 0; }
.related li { margin: 0 0 0.35rem; }
.related li + li { border-top: 1px solid color-mix(in srgb, var(--lightgray) 70%, transparent); padding-top: 0.35rem; }
`

type Row = { href: string; title: string }

export const Related: QuartzComponentConstructor<Partial<RelatedComponentOptions>> = (userOpts) => {
  const opts = { ...defaults, ...userOpts }
  const Component: QuartzComponent = ({ fileData, allFiles, displayClass }: QuartzComponentProps) => {
    const here = fileData.slug as FullSlug
    if (!here.startsWith(`${opts.folder}/`)) return null
    const bySlug = new Map(allFiles.map((f) => [f.slug as string, f]))
    const related = relatedOf(fileData.frontmatter as Record<string, unknown> | undefined)
      .map((bare) => `${opts.folder}/${bare}`)
    const relatedSet = new Set(related)
    const row = (slug: string): Row => ({
      href: resolveRelative(here, slug as FullSlug),
      title: bySlug.get(slug)?.frontmatter?.title ?? slug,
    })
    const seeAlso = related.map(row)
    const hereSimple = simplifySlug(here) as SimpleSlug
    const linkedFrom = allFiles
      .filter((f) => f.slug !== here && f.unlisted !== true && !relatedSet.has(f.slug as string))
      .filter((f) => (f.links as SimpleSlug[] | undefined)?.includes(hereSimple))
      .map((f) => row(f.slug as string))
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }))
    if (seeAlso.length === 0 && linkedFrom.length === 0) return null
    const list = (heading: string, rows: Row[]) =>
      rows.length === 0 ? null : (
        <section>
          <h2>{heading}</h2>
          <ul>{rows.map((r) => <li><a href={r.href}>{r.title}</a></li>)}</ul>
        </section>
      )
    return (
      <nav class={classNames(displayClass, "related")} aria-label={opts.seeAlso}>
        {list(opts.seeAlso, seeAlso)}
        {list(opts.linkedFrom, linkedFrom)}
      </nav>
    )
  }
  Component.css = css
  return Component
}

export default { Related }
