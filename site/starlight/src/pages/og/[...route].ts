// The social card, one PNG per page at /og/<id>.png, with the disclosure's lead as its own line
// (journey-site#50 item 2; the same reasoning as site/quartz/plugins/disclosure/src/card.tsx):
// this image is the one surface LinkedIn, X and iMessage still render, and it clamps at a few
// lines -- a disclosure folded into the description is either first (and every search snippet
// leads with it) or last (and the card clips it). As its own block, after a short summary, it is
// always on the card. astro-og-canvas lays title + description out as ONE CanvasKit paragraph
// (generateOpenGraphImage.ts: addText(title), '\n\n', addText(description)), so a blank line in the
// description text is a real paragraph break on the card.
//
// Fonts are the two IBM Plex TTFs build.sh fetches at a pinned tag and verifies by sha256 into
// src/fonts/ (gitignored): the default would fetch Noto Sans from fontsource at build time, which
// is a third-party fetch nobody pinned. Colours are the book's dark palette (journey-site#77; src/styles/custom.css): the indigo ground,
// bone text, the spice edge turned up the way the book's spine is -- one step from the garden's.
import { OGImageRoute } from 'astro-og-canvas';
import { getCollection } from 'astro:content';
import disclosure from '../../../disclosure.json' with { type: 'json' };

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const LEAD = norm(disclosure.lead);

/** The page's own summary, cut to its first sentence or ~140 chars so the lead always fits below it. */
function summary(own: string | undefined): string {
  const s = norm(own ?? '');
  if (!s) return '';
  const first = s.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? s;
  return first.length <= 160 ? first : first.slice(0, 137).replace(/\s+\S*$/, '') + '…';
}

const docs = await getCollection('docs');
const pages = Object.fromEntries(docs.map((d) => [d.id || 'index', d.data]));

export const { getStaticPaths, GET } = await OGImageRoute({
  param: 'route',
  pages,
  getImageOptions: (_path, page: (typeof docs)[number]['data']) => ({
    title: page.title,
    description: [summary(page.description), LEAD].filter(Boolean).join('\n\n'),
    bgGradient: [
      [20, 25, 36],
      [16, 20, 28],
    ],
    border: { color: [224, 168, 92], width: 14, side: 'inline-start' },
    padding: 64,
    fonts: ['./src/fonts/IBMPlexSerif-Medium.ttf', './src/fonts/IBMPlexSans-Regular.ttf'],
    font: {
      title: { families: ['IBM Plex Serif'], weight: 'Medium', size: 60, color: [239, 232, 216], lineHeight: 1.15 },
      description: { families: ['IBM Plex Sans'], size: 28, color: [201, 194, 180], lineHeight: 1.35 },
    },
    cacheDir: false,
  }),
});
