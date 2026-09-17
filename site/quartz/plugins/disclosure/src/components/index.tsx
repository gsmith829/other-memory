/**
 * Byline -- "Nagatha — an AI chronicler; what that means" under the date line of every content
 * page (journey-site#21). The colophon page itself, the link's target, gets no byline.
 *
 * The author is the page's `author:` frontmatter (every page here sets it), falling back to the
 * `author` option; the role and link text are options so the copy lives in quartz.config.yaml
 * with the disclosure text, not in code. Placed by the config's `layout:` (beforeBody, after
 * content-meta) and excluded from folder/tag listings there -- those pages are generated lists,
 * not authored prose.
 *
 * Styled to sit as a second line of content-meta (same colour, no top margin), with the author's
 * name in the page's dark colour so the eye lands on it first.
 */
import type {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
  SimpleSlug,
} from "@quartz-community/types"
import { classNames } from "@quartz-community/utils/lang"
import { resolveRelative } from "@quartz-community/utils/path"

export interface BylineOptions {
  /** Used when a page has no `author:` frontmatter. */
  author: string
  /** After the name: "<name> — <role>; <linkText>". */
  role: string
  linkText: string
  /** Where the link goes; the byline is not shown on this page. */
  colophonSlug: string
}

const defaults: BylineOptions = {
  author: "Nagatha",
  role: "an AI chronicler",
  linkText: "what that means",
  colophonSlug: "colophon",
}

const css = `
.disclosure-byline {
  margin-top: 0;
  color: var(--darkgray);
}
.disclosure-byline .disclosure-byline-author {
  color: var(--dark);
  font-weight: 600;
}
`

export const Byline: QuartzComponentConstructor<Partial<BylineOptions>> = (userOpts) => {
  const opts = { ...defaults, ...userOpts }
  const Component: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
    const slug = fileData.slug
    if (!slug || slug === opts.colophonSlug) return null
    const fmAuthor = fileData.frontmatter?.author
    const author = typeof fmAuthor === "string" && fmAuthor.trim() ? fmAuthor.trim() : opts.author
    return (
      <p class={classNames(displayClass, "disclosure-byline")}>
        <span class="disclosure-byline-author">{author}</span> &mdash; {opts.role};{" "}
        <a href={resolveRelative(slug, opts.colophonSlug as SimpleSlug)} class="internal">
          {opts.linkText}
        </a>
      </p>
    )
  }
  Component.css = css
  return Component
}
