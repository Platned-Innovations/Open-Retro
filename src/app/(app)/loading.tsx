import { EmptyState } from "@platned/ui";

/**
 * One loading state for every page in the app shell.
 *
 * Next.js resolves the nearest `loading.tsx`, so a single file at the group
 * root covers all of them. The pages differ in what they fetch but not in what
 * a spinner should say about it, and eight near-identical files would be eight
 * places to forget.
 *
 * Without this, a navigation shows the *previous* page until the new one's
 * data resolves — which on the board and insights routes is long enough to
 * look like the click did nothing.
 */
export default function Loading() {
  return <EmptyState variant="loading" message="Loading…" size="lg" />;
}
