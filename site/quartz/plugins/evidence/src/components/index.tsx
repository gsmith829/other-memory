/**
 * Evidence -- the page's receipt (journey-site#142; Joe, 2026-09-20; the slot argued by the crew
 * and settled: after the byline, before the body).
 *
 * Round 3's engineer read every page and counted zero commands, configs, logs or numbers --
 * "prose-only is also exactly what an LLM produces" -- and asked for one real, sanitised artifact
 * per page. `evidence:` is that line, told in the tray brief and copied character for character
 * (the chronicler never types it -- that is the load-bearing choice); `evidence_caption:` is her
 * one sentence saying what it shows. It sits at the HEAD of a garden page because a page is a
 * claim and its reader judges it in thirty seconds: the receipt lands where the suspicion forms,
 * under the byline that compounds it. (A chapter is a story and ends on its receipt -- the book's
 * MarkdownContent override.) A captioned figure before its discussion reads as a document; a
 * bare command would not, which is why the caption is required by the gate, not by habit.
 *
 * The figure: the line in the mono at the machine's size, no syntax colour, no copy button, one
 * line by contract (the gate refuses a line over EVIDENCE_MAX); the caption beneath in the meta
 * size. Distinct from See also / Linked from at the foot: proof above the rule, pointers below.
 * Type and colour live in the identity stylesheet (unlayered) -- component css lands in
 * @layer quartz-base and loses to it (measured on the foot's h2, #138); layout only here.
 */
import type { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "@quartz-community/types"
import { classNames } from "@quartz-community/utils/lang"

export interface EvidenceOptions {
  /** Pages under this folder carry a receipt; others never render one. */
  folder: string
}
const defaults: EvidenceOptions = { folder: "garden" }

const css = `
.evidence { margin: 1.1rem 0 0; }
.evidence pre { margin: 0; padding: 0; overflow-x: auto; white-space: pre; }
.evidence figcaption { margin-top: 0.35rem; }
`

export const Evidence: QuartzComponentConstructor<Partial<EvidenceOptions>> = (userOpts) => {
  const opts = { ...defaults, ...userOpts }
  const Component: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
    const here = fileData.slug as string
    if (!here.startsWith(`${opts.folder}/`)) return null
    const line = fileData.frontmatter?.evidence
    const caption = fileData.frontmatter?.evidence_caption
    if (typeof line !== "string" || typeof caption !== "string") return null
    return (
      <figure class={classNames(displayClass, "evidence")}>
        <pre><code>{line}</code></pre>
        <figcaption>{caption}</figcaption>
      </figure>
    )
  }
  Component.css = css
  return Component
}

export default { Evidence }
