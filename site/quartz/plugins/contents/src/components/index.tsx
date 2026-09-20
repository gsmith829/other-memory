/**
 * Contents -- the garden's table of contents (journey-site#95, D-Joe 2026-09-19).
 *
 * The explorer it replaces built its tree in the browser: one voice, one weight, one level, no
 * axis to group by -- "the only visual delineation is a capital letter" (Joe). This renders at
 * build time from the content index, so it can read every page's frontmatter and needs no
 * script: nothing for the CSP to block, no localStorage state, the same on every visit.
 *
 *   the descriptor    garden/how-this-garden-grows, pinned above the groups: it is the map
 *   the groups        every other garden page under its `topic:` -- a CLOSED list, told to the
 *                     chronicler in the tray brief's `pieces:` and copied into frontmatter,
 *                     never derived (docs/tray-brief.md carries the same five words and the
 *                     placement rule). A garden page with no topic, or one not in the list,
 *                     FAILS THE BUILD, naming the file: a page cannot reach main mislabelled.
 *   the relations     `related:` on every garden page (journey-site#133/#134, D-Joe 2026-09-20):
 *                     the slugs of the other garden pages whose claims stand or fall with this
 *                     one -- told in the brief beside `topic:`, copied never derived, a list that
 *                     may be empty. Data about the page, not words in it. This component does
 *                     not render it (the foot-of-page "See also" and the graph's edges are
 *                     #133's); it GATES it, because it is the one place that already reads every
 *                     garden page's frontmatter: a slug with no page, a page relating to itself,
 *                     a duplicate, a value that is not a list, or a relation told one way only
 *                     FAILS THE BUILD naming the file and the slug -- the same strength as
 *                     `topic:`. One way only is a failure on purpose: "stands or falls with" is
 *                     symmetric, and the back-edge onto an already-published page is exactly what
 *                     a move PR forgets (docs/tray-brief.md says the move PR adds the links the
 *                     other direction needs; this is what makes that a check, not a memory).
 *   the evidence      `evidence:` (journey-site#142, Joe 2026-09-20): the one sanitised line -- the
 *                     query, the rule, the number -- that settled the page's claim, told in the
 *                     brief and copied character for character; and `evidence_caption:`, her one
 *                     sentence saying what it shows. Rendered as a figure at the head of the page
 *                     by the rendering PR; GATED here beside related:, same strength: evidence
 *                     that is not a single non-empty line, or longer than the measure
 *                     (EVIDENCE_MAX -- a wrap is the wrong artifact), or without a caption, or a
 *                     caption without evidence, FAILS THE BUILD naming the file.
 *   in each row       the title in the serif (what is said), the tags in the mono beneath it
 *                     (what the machine set around it) -- the house's two voices doing the
 *                     work the capital letter could not
 *   the links out     the colophon, in the mono, as the book's spine sets its links out
 *
 * Not a folder: a garden page's URL is frozen the moment an Act links it, so the grouping must
 * never be part of the path. Not the first tag: an order convention nobody remembers.
 *
 * The rows are not `a.internal`: that class is the body's -- the underline, the hover popover --
 * and a table of contents wears neither.
 *
 * On a phone the whole thing is a sheet behind a toggle, as the explorer's was -- but the toggle
 * is a checkbox and a label, no script: `:checked` shows the sheet and locks the page's scroll.
 * The checkbox is visually hidden, not display:none, so it keeps its place in the tab order.
 */
import type { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "@quartz-community/types"
import { classNames } from "@quartz-community/utils/lang"
import { resolveRelative, simplifySlug } from "@quartz-community/utils/path"
import type { FullSlug, SimpleSlug } from "@quartz-community/types"

/** The closed list, in display order. The same five words live in docs/tray-brief.md. */
export const TOPICS = ["networks", "systems", "secrets", "method", "garden"] as const
type Topic = (typeof TOPICS)[number]

export interface ContentsOptions {
  /** Pages under this folder are the garden and must carry a topic. */
  folder: string
  /** The garden's descriptor: pinned above the groups, never inside one. */
  descriptorSlug: string
  /** Links out, rendered after the groups: label -> slug. */
  linksOut: Record<string, string>
  /** The heading over the whole thing. */
  title: string
}

const defaults: ContentsOptions = {
  folder: "garden",
  descriptorSlug: "garden/how-this-garden-grows",
  linksOut: { Colophon: "colophon" },
  title: "Contents",
}

type Page = { slug: FullSlug; title: string; tags: string[]; topic: Topic; related: string[] }

/**
 * The measure: the longest `evidence:` line the figure sets without wrapping. 684px of article at
 * 1440 over Plex Mono at ~0.9rem is ~79 characters; on a phone the block scrolls, never wraps.
 * A wrap is the wrong artifact -- pick a shorter line -- and the build says so. Owned by the
 * rendering (#142, dutchman): tune it there when the figure's type is fixed.
 */
import measure from "../../evidence.json" with { type: "json" }
/** The measure: ONE number, read by both gates -- here and the book's src/evidence.ts -- from
 *  ../../evidence.json, inside this plugin so build.sh's copy carries it. 72: measured by the
 *  rendering (site-plugins/evidence): 13.26px Plex Mono, 7.96px a character, 573px, inside both
 *  sites' measure at 1280 with no scroll. */
export const EVIDENCE_MAX: number = measure.max

/** `evidence:` + `evidence_caption:` read off one page: absent is absent; anything else must be
 *  a matched pair of single non-empty lines, evidence within the measure. Exported for the
 *  rendering (#142). */
export function evidenceOf(
  file: QuartzComponentProps["allFiles"][number],
): { line: string; caption: string } | undefined {
  const line = file.frontmatter?.evidence
  const caption = file.frontmatter?.evidence_caption
  const where = file.filePath ?? file.slug
  if (line === undefined && caption === undefined) return undefined
  if (line === undefined) {
    throw new Error(`contents: ${where} has evidence_caption: but no evidence: -- a caption of nothing (docs/tray-brief.md)`)
  }
  if (typeof line !== "string" || !line.trim() || /[\r\n]/.test(line)) {
    throw new Error(
      `contents: ${where} has evidence: that is not a single non-empty line -- it is the one sanitised line told in the brief, copied character for character (docs/tray-brief.md)`,
    )
  }
  // A double-quoted YAML string turns \b, \t, \x.. into control characters SILENTLY -- the regex
  // \b[0-9a-f]{40}\b came back 14 characters with two backspaces, no error (measured on #106's
  // line). A control character is never part of a told artifact; refuse it so a mis-quoted brief
  // fails the build instead of rendering a corrupted line. The brief's rule: single quotes, always.
  if (/[\x00-\x1f\x7f]/.test(line)) {
    throw new Error(
      `contents: ${where} has evidence: containing a control character -- almost always a backslash escape eaten by double quotes in YAML; single-quote the evidence: line in the brief (docs/tray-brief.md)`,
    )
  }
  if (line.length > EVIDENCE_MAX) {
    throw new Error(
      `contents: ${where} has evidence: of ${line.length} characters; the measure is ${EVIDENCE_MAX} -- a line that wraps is the wrong artifact, pick a shorter one (docs/tray-brief.md)`,
    )
  }
  if (typeof caption !== "string" || !caption.trim() || /[\r\n]/.test(caption)) {
    throw new Error(
      `contents: ${where} has evidence: but no evidence_caption: -- the one sentence in her voice saying what the line shows is required with it (docs/tray-brief.md)`,
    )
  }
  return { line, caption }
}

function topicOf(file: QuartzComponentProps["allFiles"][number]): Topic {
  const raw = file.frontmatter?.topic
  const where = file.filePath ?? file.slug
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error(
      `contents: ${where} has no \`topic:\` -- every garden page carries one of ${TOPICS.join(", ")} (told in the tray brief's pieces:, see docs/tray-brief.md)`,
    )
  }
  const t = raw.trim()
  if (!(TOPICS as readonly string[]).includes(t)) {
    throw new Error(
      `contents: ${where} has topic: ${JSON.stringify(t)}, which is not one of ${TOPICS.join(", ")} (docs/tray-brief.md)`,
    )
  }
  return t as Topic
}

/**
 * A garden slug as `related:` carries it: the part after `garden/`, the same string that ends the
 * page's URL. The same contract the stager and the courier hold a story slug to ([a-z0-9-], 1-64,
 * no leading or trailing hyphen) -- one shape on both ends of the tray, so a slug the stager let
 * through is a slug this reads.
 */
const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/

/** `related:` read off one page: absent is the empty list; anything but a list of well-formed,
 *  distinct slugs fails the build naming the file. Existence and symmetry need every page, so they
 *  are checked in `checkRelated` below, not here. Exported for the rendering (#133) to reuse. */
export function relatedOf(file: QuartzComponentProps["allFiles"][number]): string[] {
  const raw = file.frontmatter?.related
  const where = file.filePath ?? file.slug
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) {
    throw new Error(
      `contents: ${where} has related: ${JSON.stringify(raw)}, which is not a list -- related: is a list of garden slugs, possibly empty (told in the tray brief's pieces:, see docs/tray-brief.md)`,
    )
  }
  const out: string[] = []
  for (const r of raw) {
    if (typeof r !== "string" || !SLUG_RE.test(r)) {
      throw new Error(
        `contents: ${where} has related: entry ${JSON.stringify(r)}, which is not a garden slug (the part after /garden/: [a-z0-9-], 1-64 chars, no leading/trailing hyphen; docs/tray-brief.md)`,
      )
    }
    if (out.includes(r)) {
      throw new Error(`contents: ${where} lists ${JSON.stringify(r)} twice in related:`)
    }
    out.push(r)
  }
  return out
}

/**
 * The gate over the whole garden: every `related:` slug names a garden page that exists, is not
 * the page itself, and names this page back. Throws on the first defect, naming the file and the
 * slug, so a page cannot reach main pointing at nothing or pointing one way. Two passes on
 * purpose: existence and self over every page FIRST, symmetry only once those hold -- a bad slug
 * on page A also leaves A's partners unreciprocated, and a one-pass check reported the shadow
 * (B "does not list A back") before the defect (A names a page that is not there), sending the
 * reader to the wrong file (measured while building this). Runs on every render of this component
 * (it has no other hook into the whole set); at the garden's size that is nothing, and the first
 * render is the one that fails the build.
 */
export function checkRelated(garden: Page[], prefix: string): void {
  const bySlug = new Map(garden.map((p) => [p.slug as string, p]))
  for (const p of garden) {
    for (const r of p.related) {
      const target = `${prefix}${r}`
      if (target === p.slug) {
        throw new Error(`contents: ${p.slug} lists itself in related:`)
      }
      if (!bySlug.has(target)) {
        throw new Error(
          `contents: ${p.slug} has related: ${JSON.stringify(r)}, and no garden page has that slug (the slugs are the filenames under content/${prefix} without .md; docs/tray-brief.md)`,
        )
      }
    }
  }
  for (const p of garden) {
    const own = (p.slug as string).slice(prefix.length)
    for (const r of p.related) {
      const q = bySlug.get(`${prefix}${r}`)!
      if (!q.related.includes(own)) {
        throw new Error(
          `contents: ${p.slug} lists ${JSON.stringify(r)} in related:, but ${q.slug} does not list ${JSON.stringify(own)} back -- a relation is told on both pages or neither (the move PR adds the back-edge to the page already published; docs/tray-brief.md)`,
        )
      }
    }
  }
}

const byTitle = (a: Page, b: Page) =>
  a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" })

const css = `
.contents { display: flex; flex-direction: column; }
/* The pane this sits in is upstream's .sidebar: 100vh, sticky, flex column, NO overflow -- upstream
   never needed one because its explorer scrolled inside itself. This component replaced the explorer
   and inherited that duty without carrying it: once the garden outgrew one viewport (seven pages,
   #124) the last 223px were unreachable at 1440x900 (journey-site#125, found by Joe on the live
   site). So the component scrolls, as upstream's did, and the site's name and search stay pinned
   above it. A scroll container's automatic minimum is already zero, so no min-height is needed for
   the flex child to shrink (measured). Scoped wide: the phone sheet below has its own scroll. */
@media all and (min-width: 801px) {
  .contents { overflow-y: auto; }
}
.contents h2 {
  font-family: var(--codeFont); font-size: 0.78rem; font-weight: 400; letter-spacing: 0.02em;
  color: var(--gray); margin: 0 0 0.5rem;
}
.contents ul { list-style: none; margin: 0; padding: 0; }
.contents li { margin: 0; }
.contents a { color: var(--darkgray); text-decoration: none; display: block; }
.contents a:hover .contents-title { color: var(--secondary); }
.contents .contents-title {
  font-family: var(--headerFont); font-size: 0.95rem; font-weight: 500; line-height: 1.3;
  color: var(--dark);
}
.contents .contents-tags {
  font-family: var(--codeFont); font-size: 0.72rem; color: var(--gray); margin-top: 0.15rem;
  display: block; line-height: 1.3;
}
.contents .contents-page { padding: 0.45rem 0 0.45rem 0.7rem; border-left: 2px solid transparent; }
.contents .contents-page.active { border-left-color: var(--secondary); }
.contents .contents-page.active .contents-title { color: var(--dark); }
.contents .contents-descriptor { border-bottom: 1px solid var(--lightgray); margin-bottom: 0.6rem; }
.contents .contents-descriptor .contents-page { padding-left: 0; border-left: 0; }
.contents .contents-topic { margin-top: 0.7rem; }
.contents .contents-topic > h3 {
  font-family: var(--codeFont); font-size: 0.72rem; font-weight: 400; letter-spacing: 0.04em;
  color: var(--gray); margin: 0 0 0.15rem;
}
.contents .contents-topic li + li .contents-page {
  border-top: 1px solid color-mix(in srgb, var(--lightgray) 70%, transparent);
}
.contents .contents-out { margin-top: 0.9rem; padding-top: 0.6rem; border-top: 1px solid var(--lightgray); }
.contents .contents-out a {
  font-family: var(--codeFont); font-size: 0.78rem; color: var(--gray); padding: 0.25rem 0;
}
.contents .contents-out a:hover { color: var(--secondary); }
.contents .contents-out a.active { color: var(--dark); }
.contents-toggle-label { display: none; }
/* visually hidden, NOT display:none: it stays in the tab order, so Tab reaches the toggle and
   Space flips it (a label alone does not activate on Enter/Space -- review, bilby).
   The selector is ".contents input.contents-toggle", not ".contents-toggle": upstream styles
   every input[type=checkbox] at 16x16, position relative, margin-inline -1.4rem, in the same
   @layer as this css, and that attribute selector (0,1,1) outranked the bare class (0,1,0) -- so
   the box sat 6px off the left edge of every garden page from #96 until a cold reader saw it on
   a phone (round 3, 2026-09-20). Measured: 16x16 with a border at 375, a 16x2 sliver at 1440. */
.contents input.contents-toggle {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; appearance: none; transform: none;
}
.contents-toggle:focus-visible ~ .contents-toggle-label { outline: 2px solid var(--tertiary); outline-offset: 2px; }

@media all and (max-width: 800px) {
  .contents { order: -1; }
  .contents h2 { display: none; }
  .contents-toggle-label {
    display: flex; align-items: center; cursor: pointer; padding: 5px; z-index: 101;
    position: relative; color: var(--darkgray); width: 34px; height: 34px; box-sizing: border-box;
  }
  .contents-toggle-label .contents-menu { display: block; }
  .contents-toggle-label .contents-close {
    display: none; font-family: var(--codeFont); font-size: 1.1rem; line-height: 1; padding: 0 0.2rem;
  }
  .contents-toggle:checked ~ .contents-toggle-label .contents-menu { display: none; }
  .contents-toggle:checked ~ .contents-toggle-label .contents-close { display: block; }
  .contents-sheet {
    box-sizing: border-box; z-index: 100; position: absolute; top: 0; left: 0;
    width: 100vw; max-width: 100vw; height: 100dvh; max-height: 100dvh; overflow-y: auto;
    background-color: var(--light); padding: 5rem 1.25rem 2rem;
    transform: translateX(-100vw); visibility: hidden;
    transition: transform 200ms ease, visibility 200ms ease;
  }
  .contents-toggle:checked ~ .contents-sheet { transform: translateX(0); visibility: visible; }
  .contents-sheet > :first-child { border-top: 1px solid var(--lightgray); padding-top: 1rem; }
  .contents .contents-page { padding-top: 0.6rem; padding-bottom: 0.6rem; }
  .contents .contents-title { font-size: 1.05rem; }
  .contents .contents-out a { padding: 0.5rem 0; }
  /* the site's name stays above the sheet, so the sheet has one */
  .sidebar.left:has(.contents-toggle:checked) .page-title { position: relative; z-index: 101; }
  html:has(.contents-toggle:checked) { overflow: hidden; }
}
`

export const Contents: QuartzComponentConstructor<Partial<ContentsOptions>> = (userOpts) => {
  const opts = { ...defaults, ...userOpts }
  const Component: QuartzComponent = ({ fileData, allFiles, displayClass }: QuartzComponentProps) => {
    const here = fileData.slug as FullSlug
    const prefix = `${opts.folder}/`
    const garden = allFiles
      .filter((f) => typeof f.slug === "string" && f.slug.startsWith(prefix) && f.slug !== `${prefix}index`)
      .map<Page>((f) => ({
        slug: f.slug as FullSlug,
        title: f.frontmatter?.title ?? (f.slug as string),
        tags: Array.isArray(f.frontmatter?.tags) ? (f.frontmatter!.tags as string[]) : [],
        topic: topicOf(f), // every garden page, the descriptor included -- it is pinned by slug below, not exempted here
        related: relatedOf(f),
      }))
    checkRelated(garden, prefix)
    for (const f of allFiles) {
      if (typeof f.slug === "string" && f.slug.startsWith(prefix)) evidenceOf(f) // the gate; the rendering reads it again
    }
    const descriptor = garden.find((p) => p.slug === opts.descriptorSlug)
    const rest = garden.filter((p) => p.slug !== opts.descriptorSlug).sort(byTitle)
    const link = (slug: string) => resolveRelative(here, simplifySlug(slug as FullSlug) as SimpleSlug)
    const isHere = (slug: string) => simplifySlug(here) === simplifySlug(slug as FullSlug)

    const row = (p: Page) => (
      <li>
        <a href={link(p.slug)} class={classNames(undefined, "contents-page", isHere(p.slug) ? "active" : "")}>
          <span class="contents-title">{p.title}</span>
          {p.tags.length > 0 && <span class="contents-tags">{p.tags.join(" · ")}</span>}
        </a>
      </li>
    )

    return (
      <nav class={classNames(displayClass, "contents")} aria-label={opts.title}>
        <input type="checkbox" id="contents-toggle" class="contents-toggle" aria-label={opts.title} />
        <label for="contents-toggle" class="contents-toggle-label" aria-label={opts.title}>
          <svg class="contents-menu" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" />
          </svg>
          <span class="contents-close" aria-hidden="true">✕</span>
        </label>
        <div class="contents-sheet">
          <h2>{opts.title}</h2>
          {descriptor && <ul class="contents-descriptor">{row(descriptor)}</ul>}
          {TOPICS.map((t) => {
            const pages = rest.filter((p) => p.topic === t)
            if (pages.length === 0) return null
            return (
              <section class="contents-topic">
                <h3>{t}</h3>
                <ul>{pages.map(row)}</ul>
              </section>
            )
          })}
          <ul class="contents-out">
            {Object.entries(opts.linksOut).map(([label, slug]) => (
              <li>
                <a href={link(slug)} class={classNames(undefined, isHere(slug) ? "active" : "")}>{label}</a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    )
  }
  Component.css = css
  return Component
}
