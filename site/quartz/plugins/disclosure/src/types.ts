/**
 * What the transformer (./index.tsx) leaves on each page's vfile for the card (./card.tsx):
 * the page's OWN summary, untouched, and the two disclosure strings. The card is rendered by
 * the og-image emitter long after the transformer ran, and reads the same `file.data`.
 */
export interface DisclosureData {
  /** The page's own description before anything was appended (frontmatter, or the derived one). */
  own: string
  /** The full short version. */
  text: string
  /** The verbatim prefix the card shows. */
  lead: string
}

declare module "vfile" {
  interface DataMap {
    disclosure?: DisclosureData
  }
}
