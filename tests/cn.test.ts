import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

/**
 * tailwind-merge doesn't know @platned/ui's font-size scale exists
 * (`text-body`, `text-heading-sm`, ...), so by default it treats those as
 * arbitrary text *colors* — and silently drops whichever real color class
 * (`text-brand-on-brand`, `text-default`, ...) shares a `cn()` call with one,
 * since it thinks they're two colors fighting over the same slot. `cn()` in
 * `src/lib/utils.ts` registers the scale to fix this; this test is here so a
 * class dropped from that registration — or a new size token @platned/ui
 * adds that isn't in it — fails loudly instead of just rendering invisible
 * text somewhere.
 */

describe("cn merges a color class with @platned/ui's custom size classes", () => {
  it("keeps a text color when combined with a custom text size in the same call", () => {
    expect(cn("text-brand-on-brand", "text-body-tiny")).toContain("text-brand-on-brand");
    expect(cn("text-default", "text-heading-sm")).toContain("text-default");
  });

  it("still lets one custom size override an earlier one, same as real Tailwind sizes", () => {
    expect(cn("text-body", "text-heading-sm")).not.toContain("text-body ");
    expect(cn("text-body", "text-heading-sm")).toContain("text-heading-sm");
  });

  it("covers every custom font-size class @platned/ui currently ships", () => {
    const distPath = createRequire(import.meta.url).resolve("@platned/ui");
    const dist = readFileSync(distPath, "utf8");
    const sizesInBundle = new Set(
      [...dist.matchAll(/\.text-([a-z0-9-]+)\{font-size:/g)].map((m) => `text-${m[1]}`),
    );
    // Real Tailwind sizes (text-sm, text-lg, text-2xl, ...) are already
    // handled by tailwind-merge's own defaults — only the design system's
    // own names need registering here.
    const knownTailwindSizes = new Set(["text-sm", "text-lg", "text-2xl"]);
    for (const cls of sizesInBundle) {
      if (knownTailwindSizes.has(cls)) continue;
      expect(cn("text-brand-on-brand", cls)).toContain("text-brand-on-brand");
    }
  });
});
