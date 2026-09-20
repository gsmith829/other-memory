/**
 * The AI-authorship disclosure on the surfaces a reader meets BEFORE the footer (journey-site#50
 * item 2; the same standard site/quartz/plugins/disclosure holds Other Memory to, D6a).
 *
 * Starlight builds a page's <head> BEFORE route middleware runs (measured in the installed
 * 0.42.1: utils/routing/data.js computes `head: getHead(...)` in generateRouteData, then
 * middleware.js deep-clones the whole object into locals and runs this). So the description
 * entries are already in `starlightRoute.head` when we get here, and changing `entry.data.description`
 * would change nothing a reader sees -- this edits the head entries themselves:
 *
 *   <meta name="description">        the page's own summary FIRST, then the full disclosure
 *   <meta property="og:description"> the same text (Slack/Discord/Mastodon still show it)
 *   <meta property="og:image">       the card for this page (src/pages/og/[...route].ts draws the
 *                                    disclosure's lead as its own line -- the one surface
 *                                    LinkedIn/X/iMessage render clips a trailing sentence)
 *
 * The text is NOT in this file: site/starlight/disclosure.json is the single source the feed,
 * the card and check-emitted.py also read, and it must be verbatim the colophon's "short version"
 * callout. On the colophon page this middleware asserts exactly that against the entry's raw
 * markdown and THROWS otherwise, which fails `astro build` -- the config and the colophon cannot
 * drift apart silently. A build without the disclosure is not a site to publish.
 *
 * Two more things fixed here, for the same reason (computed before middleware, edited in place):
 *
 *   pagination   Starlight walks the WHOLE sidebar in order, and the last entries of ours are the
 *                Other Memory link and the colophon -- so from the last chapter "Next" landed on
 *                another website and from the colophon "Previous" did the same (journey-site#84,
 *                a cold reader's "I expected chapter II and got a different website"). The book's
 *                prev/next is chapter to chapter and nothing else: a link survives only when this
 *                page AND its target are under the chronicle's own path. The sidebar keeps the link
 *                out -- that is navigation, not pagination.
 *   og:image     the 404 has no card (src/pages/og/[...route].ts draws content entries), so it gets
 *                no og:image tag rather than one pointing at a file that does not exist.
 */
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import disclosure from '../disclosure.json' with { type: 'json' };
import { evidenceOf } from './evidence';

/** The chronicle: content/awakening/ -> /awakening/... (the `directory` the sidebar autogenerates from). */
const CHRONICLE_ID = 'awakening';
const CHRONICLE_PATH = '/awakening/';

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const TEXT = norm(disclosure.disclosure);
const LEAD = norm(disclosure.lead);

if (!TEXT) throw new Error('disclosure: site/starlight/disclosure.json has no `disclosure` text; refusing to build a site whose pages carry none');
if (!LEAD || !TEXT.startsWith(LEAD)) throw new Error('disclosure: `lead` must be a verbatim prefix of `disclosure` (it is what the social card shows); fix site/starlight/disclosure.json');

/** `own` first, the disclosure after -- feed readers show an item whole, search snippets keep the page's own words. */
export const withDisclosure = (own: string | undefined) => {
  const o = own ? own.trim() : '';
  return o ? `${o}${disclosure.separator}${TEXT}` : TEXT;
};

/** Markdown -> the plain words a reader sees, enough to find the callout's text in it. */
const plainWords = (md: string) => norm(md.replace(/^>\s?/gm, '').replace(/[*_`]+/g, ''));

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  const { entry, head } = route;

  if (entry.id === disclosure.colophonSlug) {
    const body = (entry as { body?: string }).body ?? '';
    if (!body || !plainWords(body).includes(TEXT)) {
      throw new Error(
        `disclosure: the configured text is not in content/${disclosure.colophonSlug}.md verbatim -- the colophon's short version and site/starlight/disclosure.json have drifted apart; make them agree before building`,
      );
    }
  }

  // The receipt's gate (journey-site#142, src/evidence.ts): a chapter with half a pair, a wrapped
  // line, or a caption of nothing fails the build here, naming the entry.
  evidenceOf(entry.id, entry.data as { evidence?: unknown; evidence_caption?: unknown });

  const own = entry.data.description;
  const text = withDisclosure(own);
  let seen = 0;
  for (const tag of head) {
    if (tag.tag !== 'meta' || !tag.attrs) continue;
    if (tag.attrs.name === 'description' || tag.attrs.property === 'og:description') {
      tag.attrs.content = text;
      seen += 1;
    }
  }
  // A page with no description of its own gets no description tags from Starlight at all (head.js:
  // both are conditional on `description`), so add them -- the disclosure alone is still the
  // right og:description for such a page.
  if (seen === 0) {
    head.push({ tag: 'meta', attrs: { name: 'description', content: text } });
    head.push({ tag: 'meta', attrs: { property: 'og:description', content: text } });
  }

  // The card: one PNG per page under /og/, keyed by the entry id (the same key the og route uses).
  // The 404 is not a content entry and has no card: no tag beats a tag pointing at nothing.
  if (entry.id !== '404') {
    const card = new URL(`/og/${entry.id || 'index'}.png`, context.site ?? context.url).href;
    head.push({ tag: 'meta', attrs: { property: 'og:image', content: card } });
    head.push({ tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } });
    head.push({ tag: 'meta', attrs: { property: 'og:image:height', content: '630' } });
    head.push({ tag: 'meta', attrs: { name: 'twitter:image', content: card } });
  }

  // Prev/next stay inside the book. `entry.id` is `awakening` (the front door) or `awakening/<stem>`
  // for a chapter; sidebar hrefs are `/awakening/...` for both. Anything else -- the Other Memory
  // link, the colophon, the 404 -- is neither a source nor a target of pagination.
  const inBook = (href: string | undefined) => typeof href === 'string' && href.startsWith(CHRONICLE_PATH);
  const thisPageInBook = entry.id === CHRONICLE_ID || entry.id.startsWith(`${CHRONICLE_ID}/`);
  const { pagination } = route;
  if (!thisPageInBook || !inBook(pagination.prev?.href)) pagination.prev = undefined;
  if (!thisPageInBook || !inBook(pagination.next?.href)) pagination.next = undefined;
});
