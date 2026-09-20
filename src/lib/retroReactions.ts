/**
 * The reactions a card can carry.
 *
 * Shared with the server so the list is a real constraint rather than a
 * cosmetic one. `Reaction.emoji` is an unbounded `String` column, and the
 * action accepted whatever it was given — so the picker in the UI was only ever
 * a suggestion, and any string at all could be written and then rendered on
 * every participant's board.
 *
 * No heart: the vote button already covers that, and keeping reactions distinct
 * from votes is the point.
 */
export const REACTIONS = ["👍", "🎉", "💡", "👏"] as const;

export type RetroReaction = (typeof REACTIONS)[number];
