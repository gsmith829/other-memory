// Awakening -- the dated-chapter book, on Starlight (journey-site#50; decided D12, 2026-09-17).
// Other Memory is the Quartz garden in site/quartz/; both render the same content/ tree in the
// PORTABLE subset (relative .md links within a site, absolute URLs across sites, GitHub's five
// alert types, YAML frontmatter -- scripts/portable.py). This site builds content/awakening/ and
// the colophon; the garden stays the garden's (site/starlight/build.sh assembles exactly that).
//
// Promoted from the #6 bake-off (v3, 9b810c6) with the bake-off's markdown pipeline unchanged:
// Sätteri, Astro 7's default processor, plus two standard-syntax plugins and an 8-line fix --
//   satteri-resolve-markdown-links   relative ./x.md links -> site URLs (throws on a missing target)
//   @nullpinter/satteri-admonitions-to-directives   > [!NOTE] -> :::note, Starlight's own asides
//   indexFix   the link plugin emits /awakening/index for awakening/index.md; the route is /awakening/
// Build choice recorded (#50 item 1): the peer-pinned resolver is KEPT under --legacy-peer-deps
// (build.sh says why) rather than replaced by a local hast plugin -- it is the one that refuses a
// dangling link at build time, and all nine v3 probes passed on exactly this pipeline.
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';
import { satteri } from '@astrojs/markdown-satteri';
import { satteriResolveMarkdownLinks } from 'satteri-resolve-markdown-links';
import { admonitionsToDirectives } from '@nullpinter/satteri-admonitions-to-directives';
import { fileURLToPath } from 'node:url';

const DOCS = fileURLToPath(new URL('./src/content/docs/', import.meta.url));

// The public hostname is the build's SITE_URL (build.sh reads it from the environment, default
// the placeholder below): canonical URLs, og:url, the feed's links and the sitemap are all built
// against it, so the value must be the name readers use -- journey-site#7 / #50, D4: awakening.
const SITE = process.env.SITE_URL || 'https://awakening.example';
// The sibling site, for the one sidebar link out (D12: absolute URLs across sites). The same
// public name site/quartz/quartz.config.yaml's baseUrl carries; the private origins are not
// linked from public pages.
const OTHER_MEMORY = 'https://othermemory.sardaukar.work/';

// /index -> /, /awakening/index -> /awakening/, and a trailing slash on every internal page link.
const indexFix = {
  name: 'awakening-index-fix',
  element: {
    filter: ['a'],
    visit(node, ctx) {
      const href = node.properties?.href;
      if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) return;
      const [path, suffix = ''] = href.split(/(?=[#?])/, 2);
      const clean = path.replace(/(^|\/)index$/, '$1');
      ctx.setProperty(node, 'href', (clean.endsWith('/') ? clean : clean + '/') + suffix);
    },
  },
};

export default defineConfig({
  site: SITE,
  trailingSlash: 'always',
  // The site root is the book's front door: content/awakening/index.md renders at /awakening/
  // (the same path it has on disk, so the relative links the portable subset requires keep
  // working on both generators); "/" itself is a redirect there.
  redirects: { '/': '/awakening/' },
  markdown: {
    processor: satteri({
      mdastPlugins: [
        admonitionsToDirectives({
          mapping: { NOTE: 'note', TIP: 'tip', IMPORTANT: 'note', WARNING: 'caution', CAUTION: 'danger' },
        }),
      ],
      hastPlugins: [satteriResolveMarkdownLinks({ rootDir: DOCS }), indexFix],
    }),
  },
  integrations: [
    starlight({
      title: 'Awakening',
      description:
        'The chronicle of one homelab, told in order: dated chapters, the wrong theories included. Written by an AI chronicler from the operators’ own notes.',
      customCss: ['./src/styles/custom.css'],
      // The disclosure on every surface a reader meets before the footer (D6a; #50 item 2):
      //   PageTitle   the byline under every title but the colophon's (src/components/PageTitle.astro)
      //   routeData   og:description / <meta name=description> = the page's own summary, then the
      //               disclosure; og:image -> the card; and the build-refusing assertion that the
      //               colophon still carries the text verbatim (src/routeData.ts)
      //   rss.xml     every item's description carries it (src/pages/rss.xml.js)
      //   og/*.png    the card, with the disclosure's lead as its own line (src/pages/og/[...route].ts)
      components: { PageTitle: './src/components/PageTitle.astro' },
      routeMiddleware: './src/routeData.ts',
      head: [
        // The feed, discoverable: readers' clients look for this link, and check-emitted.py
        // asserts the file it names exists.
        { tag: 'link', attrs: { rel: 'alternate', type: 'application/rss+xml', title: 'Awakening', href: '/rss.xml' } },
      ],
      plugins: [starlightLinksValidator()],
      pagination: true,
      // The spine (D10): one group -- the front door (the directory's index, labelled by its
      // title) and then the Acts in the order they were written: autogenerate sorts by filename
      // and every Act's file starts with its date -- then one link out to the sibling site and the
      // colophon. Nothing else: the garden is not rendered here.
      sidebar: [
        { label: 'The chronicle', items: [{ autogenerate: { directory: 'awakening' } }] },
        { label: 'Other Memory', link: OTHER_MEMORY, attrs: { rel: 'external' } },
        { label: 'Colophon', slug: 'colophon' },
      ],
    }),
  ],
});
