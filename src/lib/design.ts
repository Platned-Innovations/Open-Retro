/**
 * Design tokens (tasteskill palette "white-mint-tiles", Chivo + Chivo Mono,
 * soft radius). Plain values with no MUI import, so a Server Component can
 * read them; the MUI theme in `mui-theme.ts` and `globals.css` are built
 * from the same numbers.
 */
export const ds = {
  bg: "#ffffff",
  surface: "#f3f3f3",
  ink: "#232323",
  muted: "#686868",
  accent: "#a1ffcb",
  accentInk: "#232323",
  invBg: "#232323",
  invSurface: "#303030",
  invInk: "#ffffff",
  invMuted: "#a4a4a4",
  /** Ink at 11%: every resting border. */
  line: "rgba(35, 35, 35, 0.11)",
  /** Ink at 20%: field outlines, a border under the pointer. */
  lineStrong: "rgba(35, 35, 35, 0.2)",
  r: { sm: 8, md: 12, lg: 20 },
  ease: "cubic-bezier(.2, .8, .2, 1)",
  dur: "180ms",
  fontText: 'var(--font-chivo), system-ui, -apple-system, "Segoe UI", sans-serif',
  fontMono: 'var(--font-chivo-mono), ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
} as const;
