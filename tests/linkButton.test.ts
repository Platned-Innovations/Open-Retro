import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import {
  LINK_BUTTON_SIZE_CLASSES,
  LINK_BUTTON_VARIANT_CLASSES,
} from "@/components/ui/link-button";

/**
 * Keeps LinkButton honest about being a copy.
 *
 * `@platned/ui`'s Button always renders a native `<button>` with no
 * polymorphic escape hatch, so `LinkButton` re-implements its classes to style
 * a Next.js `<Link>`. That copy would otherwise drift silently on every design
 * system bump — the tokens change upstream, nothing errors, and the app quietly
 * grows two buttons that look almost the same.
 *
 * So: read the design system's own dist bundle and compare. Crude, but it
 * fails on the bump that causes the drift rather than in a screenshot review
 * months later, and it costs nothing to keep.
 */

const distPath = createRequire(import.meta.url).resolve("@platned/ui");
const dist = readFileSync(distPath, "utf8");

/** The object literal for `name`, from `var name = {` to its matching brace. */
function extractObject(source: string, name: string): string {
  const marker = `var ${name} = {`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`Could not find "${marker}" in @platned/ui's bundle`);

  let depth = 0;
  for (let i = start + marker.length - 1; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Unbalanced braces reading "${name}"`);
}

/** Every class in one key of that object, flattened out of its clsx() call. */
function classesFor(objectSource: string, key: string): Set<string> {
  const keyStart = objectSource.indexOf(`\n  ${key}: `);
  if (keyStart === -1) throw new Error(`No "${key}" key in the bundle's object`);

  const rest = objectSource.slice(keyStart + 1);
  // Up to the next top-level key (two-space indent) or the closing brace.
  const nextKey = rest.slice(1).search(/\n {2}["a-zA-Z-]+: |\n\}/);
  const body = nextKey === -1 ? rest : rest.slice(0, nextKey + 1);

  const classes = new Set<string>();
  for (const [, literal] of body.matchAll(/"([^"]*)"/g)) {
    for (const cls of literal.split(/\s+/).filter(Boolean)) {
      // A link cannot be disabled, so LinkButton deliberately omits these.
      if (!cls.startsWith("disabled:")) classes.add(cls);
    }
  }
  return classes;
}

function tokens(value: string): Set<string> {
  return new Set(value.split(/\s+/).filter(Boolean));
}

const variantStyles = extractObject(dist, "variantStyles");
const sizeStyles = extractObject(dist, "sizeStyles");

describe("the bundle is readable", () => {
  it("finds Button's style maps where the test expects them", () => {
    // If @platned/ui ever renames or restructures these, this fails first and
    // says so, rather than the comparisons below silently passing on nothing.
    expect(variantStyles).toContain("primary:");
    expect(sizeStyles).toContain("lg:");
    expect(classesFor(sizeStyles, "md").size).toBeGreaterThan(3);
  });
});

describe("LinkButton matches @platned/ui's Button", () => {
  it.each(Object.keys(LINK_BUTTON_VARIANT_CLASSES))("variant: %s", (variant) => {
    const expected = classesFor(variantStyles, variant);
    const actual = tokens(LINK_BUTTON_VARIANT_CLASSES[variant as keyof typeof LINK_BUTTON_VARIANT_CLASSES]);
    expect([...actual].sort()).toEqual([...expected].sort());
  });

  it.each(Object.keys(LINK_BUTTON_SIZE_CLASSES))("size: %s", (size) => {
    const expected = classesFor(sizeStyles, size);
    const actual = tokens(LINK_BUTTON_SIZE_CLASSES[size as keyof typeof LINK_BUTTON_SIZE_CLASSES]);
    expect([...actual].sort()).toEqual([...expected].sort());
  });
});
