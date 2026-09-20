/**
 * Where a dragged card ends up among its siblings.
 *
 * Pure and dependency-free so the ordering rule can be tested directly rather
 * than inferred from what the database ended up containing.
 *
 * `siblingIds` is the **top-level** list for the destination column, in display
 * order, *including* the dragged card when it is already in that column — i.e.
 * exactly the list the browser computed `toIndex` against. Matching those two
 * views is the whole point: the server used to rebuild the list from *every*
 * card in the column, merged children included, so as soon as a column had a
 * merged card the two lists disagreed and drops landed a slot out.
 *
 * The semantics are dnd-kit's `arrayMove`: remove the card, then insert it at
 * `toIndex`. Dragging the first of [A,B,C] onto C yields [B,C,A].
 */
export function reorder(siblingIds: string[], cardId: string, toIndex: number): string[] {
  const without = siblingIds.filter((id) => id !== cardId);
  // Clamp rather than trust: `toIndex` arrives from the client, and Array#splice
  // reads a negative index as an offset from the end, which would silently move
  // the card somewhere nobody asked for.
  const target = Math.max(0, Math.min(Math.trunc(toIndex) || 0, without.length));
  without.splice(target, 0, cardId);
  return without;
}
