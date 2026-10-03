// The book door's cast key (journey-site#459; cold read 7, 2026-10-03). The engineer: "put a 3-line
// cast list (Joe = human, Skippy/Bilby = AI engineers, Nagatha = narrator) on the front door"; the
// recruiter: "Insider vocabulary with no way in". A KEY, not the paragraphs #288 took off the door:
// at most four rows of name and role, in the meta voice, after the door's first paragraph.
//
// The words are content (the door's `cast:` frontmatter, Skippy's; Joe words identity). This file is
// the rendering's half: which page may carry one, and the escaped markup. It renders on the door only
// -- a chapter names its people and does not introduce them -- and a `cast:` anywhere else fails the
// build naming the file, the same strength as `act:` (#97).
export const CAST_PAGE = 'awakening';
export const CAST_MAX = 4;

type Row = { name: string; role: string };

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** The door's rows, or undefined. Throws, naming the entry, if a page other than the door carries one. */
export function castOf(id: string, data: { cast?: Row[] }): Row[] | undefined {
  if (!data.cast?.length) return undefined;
  if (id !== CAST_PAGE) {
    throw new Error(`[cast] ${id} has a cast: -- the key renders on the book's front door only (journey-site#459); remove it from this page's frontmatter`);
  }
  return data.cast;
}

/** The key as markup: a definition list, every string escaped (it is inserted with set:html). */
export function castHtml(rows: Row[]): string {
  const items = rows.map((r) => `<dt>${esc(r.name)}</dt><dd>${esc(r.role)}</dd>`).join('');
  return `<dl class="book-cast" aria-label="Who is who">${items}</dl>`;
}

/** Markup after the body's first paragraph (the door's thesis); before the body if it has none, so
 *  nothing handed in is lost. The door's receipt and key both go here (MarkdownContent.astro). */
export function afterFirstParagraph(body: string, html: string): string {
  const end = body.indexOf('</p>');
  return end < 0 ? html + body : body.slice(0, end + 4) + html + body.slice(end + 4);
}

export { esc };
