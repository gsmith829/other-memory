// The feed: one item per Act, newest first, every description carrying the disclosure
// (journey-site#50 item 2; D10: "a feed fires on a new chapter"). Feed readers render an item
// whole, so the page's own summary leads and the full disclosure follows -- the same order the
// page's own <meta name="description"> uses (src/routeData.ts). The colophon and the front door
// are pages, not chapters, and are not items. check-emitted.py asserts every item carries the text.
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import disclosure from '../../disclosure.json' with { type: 'json' };

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const withDisclosure = (own) => {
  const o = own ? own.trim() : '';
  return o ? `${o}${disclosure.separator}${norm(disclosure.disclosure)}` : norm(disclosure.disclosure);
};

export async function GET(context) {
  const docs = await getCollection('docs');
  const acts = docs
    .filter((d) => d.id.startsWith('awakening/') && d.id !== 'awakening')
    .sort((a, b) => (b.data.date?.getTime() ?? 0) - (a.data.date?.getTime() ?? 0));
  return rss({
    title: 'Awakening',
    description: withDisclosure(
      'The chronicle of one homelab, told in order: dated chapters, the wrong theories included.',
    ),
    site: context.site,
    items: acts.map((d) => ({
      title: d.data.title,
      pubDate: d.data.date,
      description: withDisclosure(d.data.description),
      link: `/${d.id}/`,
    })),
    customData: '<language>en</language>',
  });
}
