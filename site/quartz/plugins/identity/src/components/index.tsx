/**
 * NotFound -- the 404, designed. Upstream's 404 renders in the "minimal" frame, which draws only
 * the fixed page body (h1 "404" / a sentence / "Return to Homepage") and the FOOTER slot; the
 * config's byPageType."404".positions can clear slots but cannot add to them, and beforeBody is
 * not drawn by that frame at all. The footer slot is, and is not cleared. So this component sits
 * in the footer slot ahead of the stock footer and renders only on the 404 (the byline uses the
 * same return-null pattern for the colophon); the stylesheet hides upstream's three lines on that
 * page and lets this one fill the viewport. Upstream's inline script -- the case-insensitive
 * redirect -- stays in the DOM and still runs.
 *
 * The words are design furniture for a generated page, not content under content/; if Nagatha
 * wants them in her voice they are the two strings below.
 */
import type { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "@quartz-community/types"
import { resolveRelative } from "@quartz-community/utils/path"
import type { SimpleSlug } from "@quartz-community/types"

export interface NotFoundOptions {
  /** Where "the front door" goes. */
  homeSlug: string
  colophonSlug: string
}

const defaults: NotFoundOptions = { homeSlug: "index", colophonSlug: "colophon" }

const css = `
body[data-slug="404"] .center.minimal article.popover-hint > h1,
body[data-slug="404"] .center.minimal article.popover-hint > p,
body[data-slug="404"] .center.minimal article.popover-hint > a {
  display: none;
}
body[data-slug="404"] .center.minimal {
  display: none;
}
.om-notfound {
  min-height: calc(100vh - 6rem);
  max-width: 36rem;
  margin: 0 auto;
  padding: 18vh 1.5rem 3rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.om-notfound .om-notfound-code {
  font-family: var(--codeFont);
  font-size: 0.78rem;
  color: var(--gray);
  margin: 0 0 1.2rem;
  padding-bottom: 0.9rem;
  border-bottom: 1px solid var(--lightgray);
}
.om-notfound .om-notfound-code b {
  color: var(--secondary);
  font-weight: 600;
}
.om-notfound h1 {
  font-family: var(--headerFont);
  font-size: 2.5rem;
  font-weight: 400;
  line-height: 1.08;
  letter-spacing: -0.02em;
  color: var(--dark);
  margin: 0 0 1.1rem;
}
.om-notfound p {
  font-family: var(--headerFont);
  font-size: 1.1rem;
  line-height: 1.55;
  color: var(--darkgray);
  margin: 0 0 2rem;
}
.om-notfound ul {
  list-style: none;
  margin: 0;
  padding: 0;
  font-family: var(--codeFont);
  font-size: 0.85rem;
}
.om-notfound li {
  margin: 0 0 0.55rem;
}
.om-notfound li a {
  color: var(--secondary);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-decoration-color: color-mix(in srgb, var(--secondary) 45%, transparent);
  text-underline-offset: 0.2em;
}
.om-notfound li a:hover {
  text-decoration-color: var(--secondary);
}
@media (max-width: 800px) {
  .om-notfound { padding-top: 10vh; }
  .om-notfound h1 { font-size: 2.1rem; }
}
`

export const NotFound: QuartzComponentConstructor<Partial<NotFoundOptions>> = (userOpts) => {
  const opts = { ...defaults, ...userOpts }
  const Component: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
    const slug = fileData.slug
    if (slug !== "404") return null
    const home = resolveRelative(slug, opts.homeSlug as SimpleSlug)
    const colophon = resolveRelative(slug, opts.colophonSlug as SimpleSlug)
    return (
      <section class="om-notfound">
        <p class="om-notfound-code">
          <b>404</b> &mdash; not in Other Memory
        </p>
        <h1>Nothing was written down here.</h1>
        <p>
          The intelligences that keep this place remember only what was written down, and this
          address never was &mdash; or it was, and the record was left out on purpose. Ask a
          different question: here the right memory surfaces by association, not by address.
        </p>
        <ul>
          <li>
            <a href={home}>Back to the front door</a>
          </li>
          <li>
            <a href={colophon}>Who keeps these records, and why</a>
          </li>
        </ul>
      </section>
    )
  }
  Component.css = css
  return Component
}
