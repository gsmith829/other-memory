/**
 * The chapter's receipt -- `evidence:` and `evidence_caption:` (journey-site#142; Joe, 2026-09-20).
 *
 * `evidence:` is the one sanitised line -- the query, the rule, the number -- that proved the night,
 * told in the tray brief and copied by the chronicler character for character; `evidence_caption:`
 * is her one sentence saying what it shows. The rendering (dutchman, the same figure the garden
 * sets at the head of a page, set here at the FOOT of the chapter: a chapter opens on the night,
 * never on a command) reads the pair through `evidenceOf`. The GATE is the same one the garden's
 * contents component holds beside `related:` (site/quartz/plugins/contents), duplicated rather than
 * shared because the two sites are two component trees with nothing between them: evidence that is
 * not a single non-empty line, or longer than the measure, or without a caption, or a caption
 * without evidence, FAILS THE BUILD naming the entry. Run from routeData.ts on every page, so a
 * chapter cannot reach main with half a receipt.
 */

import measure from '../../quartz/plugins/contents/evidence.json' with { type: 'json' };

/** The measure: ONE number, read by both gates -- this file and the garden's contents component --
 *  from site/quartz/plugins/contents/evidence.json (inside the plugin, so build.sh's copy of the
 *  plugins carries it; the book reaches across with a relative import the way it reads
 *  disclosure.json). 72: at the figure's 13.26px Plex Mono, 7.96px a character, 573px -- inside
 *  the garden's 630px and the book's 592px measure at 1280 with no scroll (dutchman, measured). */
export const EVIDENCE_MAX: number = measure.max;

type Data = { evidence?: unknown; evidence_caption?: unknown };

export function evidenceOf(id: string, data: Data): { line: string; caption: string } | undefined {
  const line = data.evidence;
  const caption = data.evidence_caption;
  if (line === undefined && caption === undefined) return undefined;
  if (line === undefined) {
    throw new Error(`evidence: content/${id}.md has evidence_caption: but no evidence: -- a caption of nothing (docs/tray-brief.md)`);
  }
  if (typeof line !== 'string' || !line.trim() || /[\r\n]/.test(line)) {
    throw new Error(
      `evidence: content/${id}.md has evidence: that is not a single non-empty line -- it is the one sanitised line told in the brief, copied character for character (docs/tray-brief.md)`,
    );
  }
  if (line.length > EVIDENCE_MAX) {
    throw new Error(
      `evidence: content/${id}.md has evidence: of ${line.length} characters; the measure is ${EVIDENCE_MAX} -- a line that wraps is the wrong artifact, pick a shorter one (docs/tray-brief.md)`,
    );
  }
  if (typeof caption !== 'string' || !caption.trim() || /[\r\n]/.test(caption)) {
    throw new Error(
      `evidence: content/${id}.md has evidence: but no evidence_caption: -- the one sentence in her voice saying what the line shows is required with it (docs/tray-brief.md)`,
    );
  }
  return { line, caption };
}
