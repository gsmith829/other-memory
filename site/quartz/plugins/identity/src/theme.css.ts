/**
 * The stylesheet, as a string (see ../index.tsx for why it is not a .scss file). Plain CSS: the
 * emitter runs it through lightningcss, which minifies and handles nesting/color-mix targets.
 *
 * Every colour is one of Quartz's theme variables (--light, --lightgray, --gray, --darkgray,
 * --dark, --secondary, --tertiary, --highlight) so light and dark mode both come from the two
 * palettes in quartz.config.yaml and nothing here needs a [saved-theme] branch. The three fonts
 * are --headerFont / --bodyFont / --codeFont, from the same file.
 *
 * The idea, in one line: the prose is set in a warm serif/sans pair; everything the machine
 * wrote about the page -- date, read time, byline, breadcrumbs, the file tree, See also --
 * is set in the mono. The margins are visibly machine-set; the words are not.
 */
export const css = `
/* ---------- tokens ---------- */
:root {
  --om-measure: 40rem;          /* ~72 characters of IBM Plex Sans at 1rem */
  --om-rule: var(--lightgray);
  --om-meta-size: 0.78rem;
}

/* ---------- base ---------- */
html {
  font-size: 17px;
}
@media (max-width: 800px) {
  html { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
}
body {
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
:focus-visible {
  outline: 2px solid var(--tertiary);
  outline-offset: 2px;
}

/* ---------- headings: the serif voice ---------- */
h1, h2, h3, h4, h5, h6,
h1.article-title {
  font-family: var(--headerFont);
  color: var(--dark);
  letter-spacing: -0.012em;
}
h1.article-title {
  font-size: 2.3rem;
  font-weight: 500;
  line-height: 1.12;
  margin: 1.5rem 0 0.75rem;
}
article h2 {
  font-size: 1.55rem;
  font-weight: 500;
  line-height: 1.25;
  margin-top: 2.4rem;
}
article h3 {
  font-size: 1.2rem;
  font-weight: 600;
  line-height: 1.3;
  margin-top: 1.8rem;
}
article h4, article h5, article h6 {
  font-family: var(--bodyFont);
  font-size: 1rem;
  font-weight: 600;
}

/* ---------- measure and rhythm ---------- */
.center > .page-header,
.center > article.popover-hint {
  max-width: var(--om-measure);
}
.center > .page-header {
  margin-bottom: 0.5rem;
}
article p, article li {
  line-height: 1.65;
}
article p {
  margin: 0 0 1.1rem;
}
article ul, article ol {
  padding-left: 1.4rem;
}
article li {
  margin-bottom: 0.35rem;
}
article hr {
  border: 0;
  border-top: 1px solid var(--om-rule);
  margin: 2.5rem 0;
}
article strong {
  color: var(--dark);
}

/* Links: an underline in the accent, not the stock highlight pill. The pill is the single
   strongest "this is Quartz" tell. */
a.internal {
  background-color: transparent;
  padding: 0;
  border-radius: 0;
  font-weight: inherit;
  color: var(--secondary);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-decoration-color: color-mix(in srgb, var(--secondary) 45%, transparent);
  text-underline-offset: 0.18em;
  transition: text-decoration-color 0.12s ease;
}
a.internal:hover {
  text-decoration-color: var(--secondary);
}
article a:not(.internal) {
  color: var(--secondary);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-decoration-color: color-mix(in srgb, var(--secondary) 45%, transparent);
  text-underline-offset: 0.18em;
}

/* ---------- the machine's margin: everything set in mono ---------- */
.content-meta,
.disclosure-byline,
.breadcrumb-container,
.note-properties,
.related h2,
.toc,
.search .search-button {
  font-family: var(--codeFont);
  font-size: var(--om-meta-size);
  letter-spacing: 0;
}
.content-meta {
  margin: 0.9rem 0 0.15rem;
  color: var(--gray);
}
.disclosure-byline {
  color: var(--gray);
  margin-bottom: 0;
}
.disclosure-byline .disclosure-byline-author {
  color: var(--dark);
  font-weight: 600;
}
.breadcrumb-container {
  margin: 0 0 0.6rem;
  gap: 0.4rem;
}
.breadcrumb-container a {
  color: var(--gray);
}
.breadcrumb-container a:hover {
  color: var(--secondary);
}
.breadcrumb-container p {
  color: var(--lightgray);
  font-size: 0.7rem;
}

/* The properties box: a debugging panel in stock Quartz. Here the keys are hidden and the values
   stand alone -- the description becomes the deck under the title, the tags become chips.
   (note-properties renders includedProperties in the config's order: description first.) */
.note-properties {
  border: 0;
  background: transparent;
  padding: 0;
  margin: 0.4rem 0 0;
}
.note-properties .note-properties-header {
  display: none;
}
.note-properties .note-properties-table {
  margin: 0;
  border: 0;
  width: auto;
  border-collapse: collapse;
}
.note-properties .note-properties-row {
  border: 0;
}
.note-properties .note-properties-key {
  display: none;
}
.note-properties .note-properties-value {
  padding: 0;
  display: block;
  color: var(--darkgray);
}
.note-properties .note-properties-row:first-child .note-properties-text {
  display: block;
  font-family: var(--headerFont);
  font-style: italic;
  font-size: 1.12rem;
  line-height: 1.45;
  color: var(--darkgray);
  max-width: 34rem;
  margin-bottom: 0.5rem;
}
.note-properties .note-properties-tags a,
.note-properties .tag-link {
  font-family: var(--codeFont);
  font-size: var(--om-meta-size);
  background: transparent;
  border: 1px solid var(--om-rule);
  border-radius: 2px;
  padding: 0 0.35rem;
  color: var(--gray);
  text-decoration: none;
}
.note-properties .note-properties-tags a:hover {
  color: var(--secondary);
  border-color: var(--secondary);
}

/* ---------- the front door (index only) ---------- */
body[data-slug="index"] .page-header {
  padding: 2.5rem 0 1.5rem;
  border-bottom: 1px solid var(--om-rule);
  margin-bottom: 1.75rem;
}
body[data-slug="index"] h1.article-title {
  font-size: 3.6rem;
  font-weight: 400;
  line-height: 1;
  margin: 0 0 1rem;
  letter-spacing: -0.02em;
}
/* The deck, at front-door scale: the one line that tells the cold visitor what this is. */
body[data-slug="index"] .note-properties {
  margin: 0;
}
body[data-slug="index"] .note-properties .note-properties-row:first-child .note-properties-text {
  font-size: 1.3rem;
  line-height: 1.4;
  max-width: 30rem;
  margin-bottom: 0;
}
body[data-slug="index"] .content-meta {
  margin-top: 1.4rem;
}
/* The sendoff -- today the "Start with..." paragraph, by position, not by copy. */
body[data-slug="index"] article .markdown-preview-view > p:last-of-type {
  font-family: var(--headerFont);
  font-size: 1.12rem;
  line-height: 1.55;
  padding: 1.1rem 0 0;
  margin-top: 2rem;
  border-top: 1px solid var(--om-rule);
}
@media (max-width: 800px) {
  body[data-slug="index"] .page-header { padding-top: 1rem; }
  body[data-slug="index"] h1.article-title { font-size: 2.6rem; }
  body[data-slug="index"] .note-properties .note-properties-row:first-child .note-properties-text { font-size: 1.15rem; }
}

/* ---------- the colophon: designed to be read ---------- */
body[data-slug="colophon"] article p,
body[data-slug="colophon"] article li {
  line-height: 1.72;
}
body[data-slug="colophon"] article .markdown-preview-view > .callout[data-callout="note"] {
  border-left-width: 4px;
  padding: 0.6rem 1.3rem 0.4rem;
  margin: 1.6rem 0 2rem;
}
body[data-slug="colophon"] article .markdown-preview-view > .callout[data-callout="note"] .callout-content p {
  font-family: var(--headerFont);
  font-size: 1.1rem;
  line-height: 1.6;
}
body[data-slug="colophon"] article .markdown-preview-view > .callout[data-callout="note"] .callout-content p:first-child {
  font-family: var(--codeFont);
  font-size: var(--om-meta-size);
  color: var(--gray);
}

/* ---------- callouts: a rule down the left, in the palette, not Obsidian's blues ---------- */
.callout {
  border: 0;
  border-left: 3px solid var(--color);
  border-radius: 0 3px 3px 0;
  padding: 0.2rem 1.1rem;
  margin: 1.4rem 0;
}
.callout[data-callout] {
  --color: var(--tertiary);
  --border: var(--tertiary);
  --bg: color-mix(in srgb, var(--tertiary) 7%, transparent);
}
.callout[data-callout="tip"],
.callout[data-callout="important"],
.callout[data-callout="success"] {
  --color: var(--secondary);
  --border: var(--secondary);
  --bg: color-mix(in srgb, var(--secondary) 7%, transparent);
}
.callout[data-callout="warning"],
.callout[data-callout="caution"],
.callout[data-callout="danger"],
.callout[data-callout="failure"],
.callout[data-callout="bug"] {
  --color: color-mix(in srgb, var(--secondary) 70%, var(--dark));
  --border: var(--color);
  --bg: color-mix(in srgb, var(--secondary) 11%, transparent);
}
.callout .callout-title {
  font-family: var(--codeFont);
  font-size: var(--om-meta-size);
  letter-spacing: 0.02em;
  color: var(--color);
  padding: 0.6rem 0 0;
}
.callout .callout-title-inner p {
  color: var(--color);
  text-transform: lowercase; /* "note", "tip": a tag in the margin, not a shout */
}
.callout .callout-content > p:first-child strong {
  font-family: var(--headerFont);
  font-size: 1.05rem;
  font-weight: 600;
}

/* ---------- code ---------- */
article pre {
  border: 1px solid var(--om-rule);
  border-radius: 3px;
  background: color-mix(in srgb, var(--light) 94%, var(--dark));
}
article code {
  font-size: 0.86em;
  background: color-mix(in srgb, var(--light) 92%, var(--dark));
  border-radius: 2px;
}
article pre:has(> code.mermaid) {
  border: 0;
  background: transparent;
}
article pre > code {
  font-size: 0.82rem;
  line-height: 1.55;
  background: transparent;
}

/* ---------- the chrome: recede ---------- */
.sidebar h3 {
  font-family: var(--codeFont);
  font-size: var(--om-meta-size);
  font-weight: 400;
  color: var(--gray);
  letter-spacing: 0.02em;
  margin: 0 0 0.5rem;
}
.page-title {
  font-family: var(--headerFont);
  font-size: 1.45rem;
  font-weight: 500;
  letter-spacing: -0.015em;
  margin: 0 0 0.2rem;
}
.page-title a {
  color: var(--dark);
}
@media (max-width: 800px) {
  .page-title { font-size: 1.15rem; white-space: nowrap; }
}
/* The foot of a garden page (site/quartz/plugins/related, journey-site#133): "See also" and
   "Linked from" headings in the mono. Here and not in the component's own css because Quartz
   emits component css in @layer quartz-base, and the fonts plugin's unlayered h1..h6 rule wins
   over any layered rule; this sheet is unlayered too, and .related h2 outranks h2 within it. */
.related h2 {
  font-family: var(--codeFont);
  font-size: var(--om-meta-size);
  font-weight: 400;
  letter-spacing: 0.04em;
  color: var(--gray);
}
.related a {
  font-family: var(--headerFont);
  font-size: 0.95rem;
  font-weight: 500;
  line-height: 1.3;
  color: var(--darkgray);
  text-decoration: none;
  display: block;
}
.related a:hover {
  color: var(--secondary);
}
.search .search-button {
  border: 1px solid var(--om-rule);
  border-radius: 3px;
  background: transparent;
  color: var(--gray);
}
.search .search-button:hover {
  border-color: var(--gray);
}
.graph .graph-outer {
  border: 1px solid var(--om-rule);
  border-radius: 3px;
  background: color-mix(in srgb, var(--light) 95%, var(--dark));
}
.darkmode svg, .readermode svg {
  fill: var(--gray);
}
/* The real footer is a classless <footer> outside .center (the page-footer div is Quartz's empty
   afterBody slot, and styling it drew a second rule under the divider). One rule: Quartz's <hr>. */
#quartz-body > footer {
  font-family: var(--codeFont);
  font-size: var(--om-meta-size);
  color: var(--gray);
  margin-top: 0.5rem;
  /* The plugin's markup is fixed: the framework credit, then the links. The site's own link
     (the colophon -- the page every byline points at) should lead, so the two are drawn in
     reverse. Visual order only; the DOM and a screen reader still read credit first. */
  display: flex;
  flex-direction: column-reverse;
}
#quartz-body > footer p {
  color: var(--gray);
  margin: 0.3rem 0 0;
}
/* The footer plugin's own sheet sets ul { margin-top: -1rem } to tuck the list under the <p>'s
   default 1em bottom margin; with that margin gone the list climbed into the line above
   (measured: text boxes overlapping by 2px). The leading is chosen here, not by the plugin. */
#quartz-body > footer ul {
  margin-top: 0;
}
#quartz-body > footer a {
  color: var(--gray);
}
#quartz-body > footer a:hover {
  color: var(--secondary);
}
body[data-slug="404"] #quartz-body > footer {
  min-width: 0; /* base.scss gives the grid footer min-width: 100%, which beats any max-width */
  width: 100%;
  max-width: 36rem;
  margin: 0 auto;
  padding: 0 1.5rem 2rem;
}

/* popovers should inherit the paper, not float as a white card */
.popover .popover-inner {
  background: var(--light);
  border: 1px solid var(--om-rule);
  border-radius: 3px;
}

/* The left sidebar's table of contents is the contents plugin's (site/quartz/plugins/contents),
   which carries its own styles; the explorer it replaced is off in quartz.config.yaml. */

/* ---------- print ---------- */
@media print {
  .sidebar, .breadcrumb-container, #quartz-body > footer { display: none !important; }
  html { font-size: 11pt; }
  .center > .page-header, .center > article.popover-hint { max-width: none; }
  a.internal, article a { color: inherit; text-decoration: none; }
}
`
