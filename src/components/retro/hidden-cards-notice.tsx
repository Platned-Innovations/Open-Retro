import { EyeOff } from "lucide-react";

/**
 * Stands in for the cards safe ideation is withholding.
 *
 * Saying how many there are matters: an empty-looking column reads as "nobody
 * has written anything", which is discouraging and untrue. The cards
 * themselves were never fetched — this count comes from a separate aggregate.
 */
export function HiddenCardsNotice({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <p className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-default px-3 py-4 text-center text-body-tiny text-default-secondary">
      <EyeOff className="h-3.5 w-3.5 shrink-0" />
      {count === 1 ? "1 card from someone else" : `${count} cards from others`}, hidden until
      collecting ends
    </p>
  );
}
