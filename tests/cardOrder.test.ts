import { describe, expect, it } from "vitest";
import { reorder } from "@/lib/cardOrder";

const IDS = ["a", "b", "c", "d", "e"];

describe("reorder", () => {
  it("moves a card down to the requested index", () => {
    expect(reorder(IDS, "a", 3)).toEqual(["b", "c", "d", "a", "e"]);
  });

  it("moves a card up to the requested index", () => {
    expect(reorder(IDS, "e", 1)).toEqual(["a", "e", "b", "c", "d"]);
  });

  it("is a no-op when the card is already at that index", () => {
    expect(reorder(IDS, "c", 2)).toEqual(IDS);
  });

  it("inserts a card arriving from another column", () => {
    expect(reorder(IDS, "new", 2)).toEqual(["a", "b", "new", "c", "d", "e"]);
  });

  it("appends when the index is past the end", () => {
    expect(reorder(IDS, "a", 99)).toEqual(["b", "c", "d", "e", "a"]);
  });

  // Array#splice treats a negative index as an offset from the end, so an
  // unclamped -1 would quietly drop the card second-from-last.
  it("clamps a negative index to the front", () => {
    expect(reorder(IDS, "d", -1)).toEqual(["d", "a", "b", "c", "e"]);
  });

  it("handles a single-card column", () => {
    expect(reorder(["a"], "a", 0)).toEqual(["a"]);
  });

  it("handles an empty destination column", () => {
    expect(reorder([], "a", 0)).toEqual(["a"]);
  });
});
