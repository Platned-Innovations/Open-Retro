/**
 * Categorical chart palette — validated via the dataviz skill's
 * `validate_palette.js` (CVD-safe adjacent ordering, light mode).
 * Assign by fixed slot order; never cycle or reassign on filter.
 */
export const CHART_CATEGORICAL = [
  "#2a78d6", // 1 blue
  "#eb6834", // 2 orange
  "#1baf7a", // 3 aqua
  "#eda100", // 4 yellow
  "#e87ba4", // 5 magenta
  "#008300", // 6 green
  "#4a3aa7", // 7 violet
  "#e34948", // 8 red
] as const;

/** Diverging pair for polarity (e.g. sentiment): blue = positive, red = negative. */
export const CHART_DIVERGING = { positive: "#2a78d6", negative: "#e34948", neutral: "#c3c2b7" } as const;
