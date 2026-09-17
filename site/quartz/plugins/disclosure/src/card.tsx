/**
 * The social card, with the disclosure as its own fixed line (journey-site#20).
 *
 * The og-image emitter renders one image per page and lets the site replace its layout through
 * the `imageStructure` option -- a JS function, so it cannot come from quartz.config.yaml; it is
 * set from the overlaid quartz.ts (site/quartz/quartz.ts) via the option-override registry, the
 * route upstream documents for callback-valued options. Why a custom layout at all: this card is
 * the one surface LinkedIn, X and iMessage still render, and it clamps at a few lines. With the
 * disclosure folded into the description text it is either first (and every search snippet
 * leads with it) or last (and the card clips it). As its own element it is always on the card,
 * and the description field can lead with the page's own summary everywhere else.
 *
 * Layout is upstream's default (og-image dist at the pin: header row, title, description,
 * footer with date / reading time / tags), with the description clamped to two lines instead of
 * five and the disclosure lead placed between it and the footer. The transformer leaves the
 * page's own summary and the lead on `fileData.disclosure`; if that is absent (the transformer
 * did not run) the card degrades to the default layout with whatever description it was given
 * -- which, if the transformer did run, still ends with the disclosure.
 *
 * Satori, which rasterises this, is not a browser: every element with more than one child needs
 * `display: flex`, line clamping is the -webkit-box trio, and only the fonts it is handed exist
 * (so no italics). The vnode is read as plain {type, props}; the emitter bundles its own preact
 * jsx-runtime and satori does not care which instance built the tree.
 */
import type { ImageOptions, UserOpts } from "@quartz-community/og-image"
import { formatDate } from "@quartz-community/utils/date"
import type { JSX } from "preact"
import type { DisclosureData } from "./types"

type CardProps = ImageOptions & { userOpts: UserOpts; iconBase64?: string }

const CLAMP = (lines: number) => ({
  margin: 0,
  display: "-webkit-box",
  WebkitBoxOrient: "vertical" as const,
  WebkitLineClamp: lines,
  overflow: "hidden",
  textOverflow: "ellipsis",
})

/** The shape of `cfg.theme` this card reads; `@quartz-community/types` declares it `unknown`. */
type Theme = {
  typography: { header: string | { name: string }; body: string | { name: string } }
  colors: Record<string, Record<"light" | "lightgray" | "gray" | "darkgray" | "dark" | "secondary" | "highlight", string>>
}

// Satori font lookup is by family name; upstream passes the configured families as loaded.
const family = (spec: string | { name: string }) => (typeof spec === "string" ? spec : spec.name)

/** The page's date of the configured kind (created-modified-date's `defaultDateType`), as upstream's default resolves it. */
const pageDate = (fileData: CardProps["fileData"]): Date | undefined => {
  const kind = (fileData as { defaultDateType?: string }).defaultDateType
  return kind ? fileData.dates?.[kind] : undefined
}

/** Word count -> minutes, the same arithmetic upstream's default uses (reading-time's 200 wpm). */
const readingMinutes = (text: string) => Math.ceil(text.trim().split(/\s+/).filter(Boolean).length / 200)

export const disclosureCard = ({ cfg, userOpts, title, description, fileData, iconBase64 }: CardProps): JSX.Element => {
  const { colorScheme } = userOpts
  const theme = cfg.theme as Theme
  const colors = theme.colors[colorScheme]
  const bodyFont = family(theme.typography.body)
  const headerFont = family(theme.typography.header)
  const useSmallerFont = title.length > 32

  // og-image types fileData narrowly (SocialImageFileData) but hands over the page's whole file.data.
  const disclosure = (fileData as { disclosure?: DisclosureData }).disclosure
  const summary = disclosure?.own ?? description
  const lead = disclosure?.lead

  const rawDate = pageDate(fileData)
  const date = rawDate ? formatDate(rawDate, cfg.locale) : null
  const readingTimeText = (userOpts.readingTimeText ?? ((m: number) => `${m} min read`))(readingMinutes(fileData.text ?? ""))
  const tags: string[] = fileData.frontmatter?.tags ?? []

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        backgroundColor: colors.light,
        padding: "2.5rem",
        fontFamily: bodyFont,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
        {iconBase64 && <img src={iconBase64} alt="" width={56} height={56} style={{ borderRadius: "50%" }} />}
        <div style={{ display: "flex", fontSize: 32, color: colors.gray, fontFamily: bodyFont }}>{cfg.baseUrl}</div>
      </div>

      <div style={{ display: "flex", marginTop: "1rem", marginBottom: "1rem" }}>
        <h1
          style={{
            ...CLAMP(2),
            fontSize: useSmallerFont ? 64 : 72,
            fontFamily: headerFont,
            fontWeight: 700,
            color: colors.dark,
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>
      </div>

      <div style={{ display: "flex", flex: 1, fontSize: 34, color: colors.darkgray, lineHeight: 1.4 }}>
        <p style={CLAMP(lead ? 2 : 5)}>{summary}</p>
      </div>

      {lead && (
        <div
          style={{
            display: "flex",
            marginTop: "1rem",
            paddingTop: "1rem",
            borderTop: `1px solid ${colors.lightgray}`,
            fontSize: 26,
            color: colors.darkgray,
            lineHeight: 1.35,
          }}
        >
          <p style={CLAMP(3)}>{lead}</p>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "1rem",
          paddingTop: "1rem",
          borderTop: `1px solid ${colors.lightgray}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "2rem", color: colors.gray, fontSize: 28 }}>
          {date && (
            <div style={{ display: "flex", alignItems: "center" }}>
              <svg style={{ marginRight: "0.5rem" }} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" role="img" aria-label="Date">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {date}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center" }}>
            <svg style={{ marginRight: "0.5rem" }} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" role="img" aria-label="Reading time">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {readingTimeText}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "60%" }}>
          {tags.slice(0, 3).map((tag) => (
            <div
              key={tag}
              style={{
                display: "flex",
                padding: "0.5rem 1rem",
                backgroundColor: colors.highlight,
                color: colors.secondary,
                borderRadius: "10px",
                fontSize: 24,
              }}
            >
              #{tag}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
