import { describe, expect, it } from "vitest";
import { extractThemes } from "@/lib/insights/themes";

const card = (id: string, retrospectiveId: string, content: string) => ({
  id,
  retrospectiveId,
  content,
});

describe("extractThemes", () => {
  it("surfaces a term that appears across several retros", () => {
    const themes = extractThemes([
      card("1", "r1", "deployment keeps breaking"),
      card("2", "r2", "deployment was painful again"),
      card("3", "r3", "the deployment process needs attention"),
    ]);

    expect(themes[0].term).toBe("deployment");
    expect(themes[0].retroCount).toBe(3);
  });

  /**
   * The distinction the whole ranking rests on: one person saying a thing
   * repeatedly in one retro is not a recurring theme.
   */
  it("ignores a term repeated within a single retro", () => {
    const themes = extractThemes([
      card("1", "r1", "flaky flaky flaky tests are flaky"),
      card("2", "r1", "flaky tests again"),
      card("3", "r1", "so many flaky tests"),
    ]);

    expect(themes).toHaveLength(0);
  });

  it("finds phrases, not just words", () => {
    const themes = extractThemes([
      card("1", "r1", "code review takes too long"),
      card("2", "r2", "code review queue is growing"),
    ]);

    expect(themes.map((t) => t.term)).toContain("code review");
  });

  /** "code review", "code", "review" is one theme reported three times. */
  it("drops a single word when a phrase containing it scores as well", () => {
    const themes = extractThemes([
      card("1", "r1", "code review takes too long"),
      card("2", "r2", "code review queue is growing"),
    ]);

    expect(themes.map((t) => t.term)).not.toContain("code");
    expect(themes.map((t) => t.term)).not.toContain("review");
  });

  it("skips stopwords and very short words", () => {
    const themes = extractThemes([
      card("1", "r1", "we should do it at the end of a go"),
      card("2", "r2", "we should do it at the end of a go"),
    ]);

    expect(themes.map((t) => t.term)).not.toContain("should");
    expect(themes.map((t) => t.term)).not.toContain("the");
    expect(themes.map((t) => t.term)).not.toContain("go");
  });

  it("is case and punctuation insensitive", () => {
    const themes = extractThemes([
      card("1", "r1", "Standups!"),
      card("2", "r2", "standups..."),
    ]);

    expect(themes[0].term).toBe("standups");
  });

  it("returns nothing when there is nothing repeated", () => {
    expect(
      extractThemes([card("1", "r1", "onboarding"), card("2", "r2", "monitoring")]),
    ).toHaveLength(0);
  });

  it("respects the limit", () => {
    const cards = Array.from({ length: 30 }, (_, i) => [
      card(`a${i}`, "r1", `subject${i} matters`),
      card(`b${i}`, "r2", `subject${i} matters`),
    ]).flat();

    expect(extractThemes(cards, { limit: 5 })).toHaveLength(5);
  });

  it("copes with empty input", () => {
    expect(extractThemes([])).toEqual([]);
  });
});
