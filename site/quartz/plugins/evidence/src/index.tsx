/**
 * Evidence -- the component is ./components; this transformer half does one thing: it puts the
 * receipt into the page's searchable text. (It also has to exist: the loader skips a transformer
 * that carries none of textTransform / markdownPlugins / htmlPlugins; measured on the identity
 * plugin, 2026-09-17.) The GATE for the pair -- single non-empty lines, within the measure, caption
 * iff evidence -- is the contents component's `evidenceOf` (#145, Bilby); this reads leniently and
 * lets that gate name the file, as `related` does.
 *
 * Why (cold read 7, 2026-10-03): "'docker' matched only the Colophon." The one garden page showing
 * `docker stats showed 510/512 PIDs` shows it only in its receipt, and the receipt is frontmatter;
 * @quartz-community/description builds `file.data.text` from the BODY, and content-index ships that
 * text as the search index. So a reader searching for the line they saw at the top of a page got
 * nothing. The line and her caption are prepended here, in the order the page shows them, after
 * description (order 70; this plugin is 99) has derived the text and set the page's description --
 * which this leaves alone. The text's other readers: content-meta's reading time (the receipt is
 * read on the page, so it counts) and RSS, which reads richContent or description, not text.
 * Escaped as description escapes the body; her `code` backticks dropped as the figure drops them.
 */
import type { QuartzTransformerPlugin } from "@quartz-community/types"
import { escapeHTML } from "@quartz-community/utils/escape"

const plain = (s: string) => escapeHTML(s.replace(/`([^`\n]+)`/g, "$1").replace(/\s+/g, " ").trim())

const Evidence: QuartzTransformerPlugin = () => ({
  name: "Evidence",
  htmlPlugins() {
    return [
      () => (_tree, file) => {
        const line = file.data.frontmatter?.evidence
        const caption = file.data.frontmatter?.evidence_caption
        if (typeof line !== "string" || typeof caption !== "string") return
        file.data.text = `${plain(line)} ${plain(caption)} ${file.data.text ?? ""}`
      },
    ]
  },
})

export default Evidence
