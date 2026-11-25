/**
 * Design tokens (tasteskill palette "white-mint-tiles", Chivo + Chivo Mono,
 * soft radius), in two schemes.
 *
 * `palettes` holds the raw values for each scheme; MUI needs real colours to
 * build its palette. Everything else reads `ds`, whose colours are CSS
 * variables set in globals.css (`:root` for light, `.dark` for dark). A
 * component written against `ds` therefore follows the mode with no code of
 * its own, and a Server Component can use it too since nothing here imports
 * MUI.
 *
 * Dark is the palette's own inverse ground: the ink becomes the page, and
 * mint becomes the action colour.
 */
export const palettes = {
  light: {
    bg: "#ffffff",
    surface: "#f3f3f3",
    card: "#ffffff",
    ink: "#232323",
    muted: "#686868",
    accent: "#a1ffcb",
    accentInk: "#232323",
    action: "#232323",
    actionInk: "#ffffff",
    line: "rgba(35, 35, 35, 0.11)",
    lineStrong: "rgba(35, 35, 35, 0.2)",
    focusRing: "rgba(161, 255, 203, 0.75)",
  },
  dark: {
    bg: "#161616",
    surface: "#1f1f1f",
    card: "#232323",
    ink: "#ededed",
    muted: "#a4a4a4",
    accent: "#a1ffcb",
    accentInk: "#161616",
    action: "#a1ffcb",
    actionInk: "#161616",
    line: "rgba(237, 237, 237, 0.11)",
    lineStrong: "rgba(237, 237, 237, 0.22)",
    focusRing: "rgba(161, 255, 203, 0.35)",
  },
} as const;

/** `color-mix` of the current ink at `pct`%: a tint that works in both schemes. */
export const inkMix = (pct: number) => `color-mix(in oklab, var(--p-ink) ${pct}%, transparent)`;

export const ds = {
  bg: "var(--p-bg)",
  surface: "var(--p-surface)",
  card: "var(--p-card)",
  ink: "var(--p-ink)",
  muted: "var(--p-muted)",
  accent: "var(--p-accent)",
  accentInk: "var(--p-accent-ink)",
  action: "var(--p-action)",
  actionInk: "var(--p-action-ink)",
  /** Ink at 11%: every resting border. */
  line: "var(--p-line)",
  /** Ink at ~20%: field outlines, a border under the pointer. */
  lineStrong: "var(--p-line-strong)",
  /** The mint ring: a focused field, the card under discussion. */
  focusRing: "var(--p-focus-ring)",

  /**
   * Fixed values for surfaces that stay dark in both modes (the login brand
   * panel and the board preview inside it).
   */
  fixed: {
    ink: "#232323",
    accent: "#a1ffcb",
    invBg: "#232323",
    invSurface: "#303030",
    invInk: "#ffffff",
    invMuted: "#a4a4a4",
  },

  r: { sm: 8, md: 12, lg: 20 },
  ease: "cubic-bezier(.2, .8, .2, 1)",
  dur: "180ms",
  fontText: 'var(--font-chivo), system-ui, -apple-system, "Segoe UI", sans-serif',
  fontMono: 'var(--font-chivo-mono), ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
} as const;
