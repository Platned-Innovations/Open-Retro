/**
 * How much weight a card carries.
 *
 * One definition, shared by the board, the DISCUSS ordering and (later) the
 * insights view, so those three can never disagree about which card the group
 * cared most about.
 */

type Scoreable = { voteCount: number | null; grouped: { voteCount: number | null }[] };

/**
 * A merged stack scores the lead card's votes plus every child's.
 *
 * Counting only the lead card would destroy the very signal that made them
 * duplicates: three people raising the same thing separately is a stronger
 * result than one person raising it once, and merging should preserve that
 * rather than discard two thirds of it.
 *
 * `null` means "hidden from this viewer" (tallies are concealed during VOTE),
 * and is treated as zero for ordering purposes — the server computes the real
 * order, so a client can never derive a hidden tally by watching the sort.
 */
export function effectiveVoteCount(card: Scoreable): number {
  const own = card.voteCount ?? 0;
  return card.grouped.reduce((total, child) => total + (child.voteCount ?? 0), own);
}
