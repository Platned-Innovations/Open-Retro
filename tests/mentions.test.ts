import { describe, expect, it } from "vitest";
import { extractMentionedUserIds } from "@/lib/mentions";

const MEMBERS = [
  { id: "sam", name: "Sam" },
  { id: "samantha", name: "Samantha" },
  { id: "jane", name: "Jane Doe" },
];

describe("extractMentionedUserIds", () => {
  it("matches a plain mention", () => {
    expect(extractMentionedUserIds("thanks @Sam", MEMBERS)).toEqual(["sam"]);
  });

  it("matches a mention followed by punctuation", () => {
    expect(extractMentionedUserIds("@Sam, can you look?", MEMBERS)).toEqual(["sam"]);
  });

  it("matches a multi-word name", () => {
    expect(extractMentionedUserIds("ask @Jane Doe about it", MEMBERS)).toEqual(["jane"]);
  });

  // The bug: a substring test matched "@Sam" inside "@Samantha", so mentioning
  // one person emailed two.
  it("does not match a shorter name inside a longer one", () => {
    expect(extractMentionedUserIds("over to @Samantha", MEMBERS)).toEqual(["samantha"]);
  });

  it("matches both when both are genuinely mentioned", () => {
    const ids = extractMentionedUserIds("@Sam and @Samantha", MEMBERS);
    expect([...ids].sort()).toEqual(["sam", "samantha"]);
  });

  it("ignores a name that appears without an @", () => {
    expect(extractMentionedUserIds("Sam said so", MEMBERS)).toEqual([]);
  });

  it("is case-insensitive", () => {
    expect(extractMentionedUserIds("cc @sam", MEMBERS)).toEqual(["sam"]);
  });

  it("returns nothing for an empty mention list", () => {
    expect(extractMentionedUserIds("@Sam", [])).toEqual([]);
  });
});
