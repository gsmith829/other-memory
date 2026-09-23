/**
 * Theme -- Auto / Dark / Light (journey-site cold read 5, 2026-09-23; Joe's word).
 *
 * WHY. The book has three states and follows the OS until a reader chooses otherwise; the garden
 * had upstream's two-state sun/moon, which pins a choice the moment it is touched. So a reader who
 * flipped the garden once saw the two sites disagree from then on -- the round-5 recruiter: "the
 * two sites rendered in different themes side by side… reads as two different projects for a
 * second", and the engineer noticed the control itself differs. Giving the garden the book's three
 * states fixes the disagreement at its source, on one site, with no cookie and no cross-domain
 * anything: both sites default to Auto, and Auto is the OS on both.
 *
 * "Auto" is the ABSENCE of the stored key, which is already how upstream reads it
 * (`localStorage.getItem("theme") ?? OS`), so nothing else in the build has to learn a new value.
 *
 * Two scripts, upstream's shape:
 *   beforeDOMLoaded  sets `saved-theme` from the stored value or the OS, BEFORE first paint -- the
 *                    same line upstream's darkmode runs, kept so the page never flashes.
 *   afterDOMLoaded   wires the select, applies on `nav` (the SPA router reuses the DOM), and
 *                    dispatches `themechange` -- mermaid listens for it to re-theme diagrams.
 * Unlike upstream's, the OS listener does NOT overwrite a reader's choice: on Auto the page follows
 * the OS, and a pinned Dark or Light stays pinned. That is what the book does.
 */
import type { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "@quartz-community/types"
import { classNames } from "@quartz-community/utils/lang"

export interface ThemeOptions {
  /** The control's accessible name. */
  label: string
}
const defaults: ThemeOptions = { label: "Colour theme" }

const css = `
.theme-select {
  font-family: var(--codeFont);
  font-size: var(--om-meta-size);
  color: var(--gray);
  background: transparent;
  border: 1px solid var(--om-rule);
  border-radius: 3px;
  padding: 0.15rem 0.3rem;
  cursor: pointer;
}
.theme-select:hover { border-color: var(--gray); }
.theme-select:focus-visible { outline: 2px solid var(--tertiary); outline-offset: 2px; }
`

/**
 * The OS's theme, as ONE expression interpolated into both scripts below. It is upstream's form --
 * test `light`, fall back to dark -- and it is shared rather than written twice because writing it
 * twice is exactly how the two drifted: the before-paint script tested `light` (no preference ->
 * dark) and the after-load one tested `dark` (no preference -> light), so a browser reporting
 * NEITHER painted dark and then flipped to light on every full load, with a pointless `themechange`
 * to mermaid behind it (Bilby, review 522 on #198; my own no-flash measurement could not see it
 * because this machine reports a preference).
 */
const OS_THEME = `(window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")`

/** Before first paint: the stored choice, or the OS. Absent key = Auto. */
const beforeDOMLoaded = `
  try {
    var os = ${OS_THEME}
    var saved = localStorage.getItem("theme")
    document.documentElement.setAttribute("saved-theme", saved === "dark" || saved === "light" ? saved : os)
  } catch (e) {}
`

const afterDOMLoaded = `
  const osTheme = () => ${OS_THEME}
  const stored = () => { try { const v = localStorage.getItem("theme"); return v === "dark" || v === "light" ? v : null } catch (e) { return null } }
  // The classes are (re)applied on every nav because the router swaps the body; the EVENT fires only
  // when the theme actually changed. Upstream never dispatches it on load either, and mermaid
  // re-renders every diagram on it (review 522).
  const apply = (t) => {
    const was = document.documentElement.getAttribute("saved-theme")
    document.documentElement.setAttribute("saved-theme", t)
    document.body?.classList.remove("theme-dark", "theme-light")
    document.body?.classList.add("theme-" + t)
    if (was !== t) document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: t } }))
  }
  const sync = () => {
    const saved = stored()
    for (const s of document.getElementsByClassName("theme-select")) s.value = saved ?? "auto"
    apply(saved ?? osTheme())
  }
  const onChange = (e) => {
    const v = e.target.value
    try { v === "auto" ? localStorage.removeItem("theme") : localStorage.setItem("theme", v) } catch (err) {}
    sync()
  }
  const mq = window.matchMedia("(prefers-color-scheme: dark)")
  const onOS = () => { if (stored() === null) sync() }
  mq.addEventListener("change", onOS)
  const wire = () => {
    for (const s of document.getElementsByClassName("theme-select")) {
      s.addEventListener("change", onChange)
      window.addCleanup?.(() => s.removeEventListener("change", onChange))
    }
    sync()
  }
  document.addEventListener("nav", wire)
`

export const Theme: QuartzComponentConstructor<Partial<ThemeOptions>> = (userOpts) => {
  const opts = { ...defaults, ...userOpts }
  const Component: QuartzComponent = ({ displayClass }: QuartzComponentProps) => (
    <select class={classNames(displayClass, "theme-select")} aria-label={opts.label}>
      <option value="auto">Auto</option>
      <option value="dark">Dark</option>
      <option value="light">Light</option>
    </select>
  )
  Component.css = css
  Component.beforeDOMLoaded = beforeDOMLoaded
  Component.afterDOMLoaded = afterDOMLoaded
  return Component
}

export default { Theme }
