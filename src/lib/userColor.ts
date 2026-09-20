const PALETTE = [
  "#f97316", // orange
  "#22c55e", // green
  "#3b82f6", // blue
  "#a855f7", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#eab308", // yellow
  "#ef4444", // red
];

/** Same user always gets the same color, no coordination needed between clients. */
export function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

/**
 * Relative luminance, per WCAG 2.1's definition.
 *
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance — the gamma expansion
 * matters: a naive average of the channels puts yellow and blue in the same
 * place, which is exactly the mistake that produced white-on-yellow initials.
 */
function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/**
 * Black or white text on a palette colour, whichever is actually readable.
 *
 * `text-white` was hardcoded across the whole palette, which gave roughly
 * 1.8:1 on the yellow, 1.9:1 on the green and 2.3:1 on the teal — against a
 * 4.5:1 requirement, at the smallest type size in the app. The threshold
 * below is where black overtakes white in contrast against the same
 * background; both are then checked against the palette in the tests.
 */
export function textColorOn(hex: string): "#000000" | "#ffffff" {
  return relativeLuminance(hex) > 0.179 ? "#000000" : "#ffffff";
}

/** Contrast ratio between two hex colours, 1:1 to 21:1. */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}
