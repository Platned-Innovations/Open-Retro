import { describe, expect, it } from "vitest";
import { colorForUser, contrastRatio, textColorOn } from "@/lib/userColor";

/**
 * Every colour a presence avatar or live cursor can be drawn in.
 *
 * Derived rather than hardcoded: a colour added to the palette without a
 * readable text pairing should fail here, not in a screen reader audit.
 */
const PALETTE = [...new Set(Array.from({ length: 400 }, (_, i) => colorForUser(`user-${i}`)))];

/** WCAG 2.1 AA for text below 18.66px — which these initials and labels are. */
const AA_NORMAL_TEXT = 4.5;

describe("palette", () => {
  it("covers every colour, so the assertions below mean something", () => {
    expect(PALETTE.length).toBe(8);
  });

  it("gives the same person the same colour every time", () => {
    expect(colorForUser("abc123")).toBe(colorForUser("abc123"));
  });
});

describe("contrast", () => {
  /**
   * The bug this replaces: `text-white` was hardcoded across the palette,
   * giving roughly 1.8:1 on the yellow and 1.9:1 on the green.
   */
  it("picks a text colour that clears AA on every palette colour", () => {
    for (const background of PALETTE) {
      const ratio = contrastRatio(background, textColorOn(background));
      expect(
        ratio,
        `${background} on ${textColorOn(background)} is only ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    }
  });

  it("would have failed on the old hardcoded white", () => {
    const failures = PALETTE.filter((c) => contrastRatio(c, "#ffffff") < AA_NORMAL_TEXT);
    expect(failures.length).toBeGreaterThan(0);
  });

  it("computes a known ratio correctly", () => {
    // Black on white is the maximum the scale defines.
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });
});
