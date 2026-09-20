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
 *
 * The documentation-range note (Joe, 2026-09-20, reading the first figures live): a sanitised line
 * carries RFC 5737 addresses (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24), RFC 3849 prefixes
 * (2001:db8::/32) and RFC 2606 names (example.com/.net/.org) in place of the estate's own -- the
 * leak gate passes them precisely because they can never be real. Unlabelled, `ip route get
 * 192.0.2.3` reads as a lookup for a documentation address, or as an author who thinks TEST-NET-1
 * is LAN space. The tray brief always said "use one, and say it is one"; the saying is now done
 * here, mechanically, on every figure whose line carries one, so it cannot be forgotten per page.
 * Same detection in the book's src/evidence.ts (two trees, duplicated by design).
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
.evidence .evidence-note { margin: 0.35rem 0 0; }
`

/** RFC 5737 / RFC 3849 / RFC 2606: the documentation ranges and names the sanitiser substitutes. */
const DOC_V4 = /(?<![\d.])(?:192\.0\.2|198\.51\.100|203\.0\.113)\.\d{1,3}(?![\d.])/
const DOC_V6 = /\b2001:db8:/i
const DOC_NAME = /\bexample\.(?:com|net|org)\b/i

/** The note's text, or undefined when the line carries none of them. Cites only the RFCs matched. */
export function docRangeNote(line: string): string | undefined {
  const v4 = DOC_V4.test(line), v6 = DOC_V6.test(line), name = DOC_NAME.test(line)
  if (!v4 && !v6 && !name) return undefined
  const rfcs = [v4 && "RFC 5737", v6 && "RFC 3849", name && "RFC 2606"].filter(Boolean).join(", ")
  const addr = v4 || v6
  const what = addr && name ? "Addresses and names shown are documentation values" : addr ? "Addresses shown are documentation ranges" : "Names shown are reserved example domains"
  return `${what} (${rfcs}) standing in for the estate's own.`
}

export const Evidence: QuartzComponentConstructor<Partial<EvidenceOptions>> = (userOpts) => {
  const opts = { ...defaults, ...userOpts }
  const Component: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
    const here = fileData.slug as string
    if (!here.startsWith(`${opts.folder}/`)) return null
    const line = fileData.frontmatter?.evidence
    const caption = fileData.frontmatter?.evidence_caption
    if (typeof line !== "string" || typeof caption !== "string") return null
    const note = docRangeNote(line)
    return (
      <figure class={classNames(displayClass, "evidence")}>
        <pre><code>{line}</code></pre>
        <figcaption>{caption}</figcaption>
        {note && <p class="evidence-note">{note}</p>}
      </figure>
    )
  }
  Component.css = css
  return Component
}

export default { Evidence }
