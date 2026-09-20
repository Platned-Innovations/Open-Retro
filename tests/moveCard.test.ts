import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createCard, moveCard } from "@/server/retro/cards";
import { asUser, seedCard, seedFixture, type Fixture } from "./factory";

let f: Fixture;
beforeEach(async () => {
  f = await seedFixture();
});

/** Top-level cards in a column, in the order the board would render them. */
async function topLevelOrder(columnId: string): Promise<string[]> {
  const cards = await prisma.retroCard.findMany({
    where: { columnId, groupId: null },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { content: true },
  });
  return cards.map((c) => c.content);
}

describe("moveCard", () => {
  it("reorders top-level cards", async () => {
    const column = f.retroA.columns[0];
    for (const [i, content] of ["a", "b", "c"].entries()) {
      await seedCard(f.retroA, { authorId: f.users.projA1Member.id, content, order: i });
    }
    const a = await prisma.retroCard.findFirstOrThrow({ where: { content: "a" } });

    asUser(f.users.projA1Member);
    await moveCard({
      retrospectiveId: f.retroA.id,
      cardId: a.id,
      toColumnId: column.id,
      toIndex: 2,
    });

    expect(await topLevelOrder(column.id)).toEqual(["b", "c", "a"]);
  });

  /**
   * The bug this exists for: the browser computes `toIndex` against top-level
   * cards only, but the server used to rebuild the sibling list from *every*
   * card in the column. A merged child occupying a slot pushed the insert one
   * place short — so the drop landed in the wrong place, and every sibling's
   * `order` was rewritten to match.
   */
  it("lands in the right place when the column contains a merged card", async () => {
    const column = f.retroA.columns[0];
    const a = await seedCard(f.retroA, {
      authorId: f.users.projA1Member.id,
      content: "a",
      order: 0,
    });
    // A merged child of "a", sitting between "a" and "b" by `order`.
    await seedCard(f.retroA, {
      authorId: f.users.projA1Member.id,
      content: "merged",
      order: 1,
      groupId: a.id,
    });
    await seedCard(f.retroA, { authorId: f.users.projA1Member.id, content: "b", order: 2 });
    await seedCard(f.retroA, { authorId: f.users.projA1Member.id, content: "c", order: 3 });

    // The board shows [a, b, c]; dragging "a" onto "c" is toIndex 2.
    asUser(f.users.projA1Member);
    await moveCard({
      retrospectiveId: f.retroA.id,
      cardId: a.id,
      toColumnId: column.id,
      toIndex: 2,
    });

    expect(await topLevelOrder(column.id)).toEqual(["b", "c", "a"]);
  });

  it("moves a card into a different column", async () => {
    const [from, to] = f.retroA.columns;
    const card = await seedCard(f.retroA, {
      authorId: f.users.projA1Member.id,
      content: "moved",
      columnIndex: 0,
    });
    await seedCard(f.retroA, {
      authorId: f.users.projA1Member.id,
      content: "existing",
      columnIndex: 1,
    });

    asUser(f.users.projA1Member);
    await moveCard({
      retrospectiveId: f.retroA.id,
      cardId: card.id,
      toColumnId: to.id,
      toIndex: 0,
    });

    expect(await topLevelOrder(to.id)).toEqual(["moved", "existing"]);
    expect(await topLevelOrder(from.id)).toEqual([]);
  });
});

describe("createCard ordering", () => {
  it("appends each card after the last", async () => {
    const column = f.retroA.columns[0];
    asUser(f.users.projA1Member);

    for (const content of ["one", "two", "three"]) {
      await createCard({ retrospectiveId: f.retroA.id, columnId: column.id, content });
    }

    expect(await topLevelOrder(column.id)).toEqual(["one", "two", "three"]);
  });

  /**
   * Genuinely simultaneous creates can still land on the same `order`: reading
   * the last position and inserting is one transaction now, but at Postgres's
   * default READ COMMITTED isolation concurrent transactions can each read the
   * same maximum. Making that impossible would need a unique index on
   * (columnId, order) plus retry-on-conflict, which is a migration and a
   * backfill for a purely cosmetic problem.
   *
   * What has to hold instead is that a tie is *harmless*: every card is kept,
   * and the board's `[order, createdAt]` sort renders them in a stable,
   * predictable order rather than reshuffling between refreshes. The next drag
   * rewrites the positions to 0..n-1 anyway.
   */
  it("keeps concurrent cards in a stable, complete order", async () => {
    const column = f.retroA.columns[0];
    asUser(f.users.projA1Member);

    await Promise.all(
      ["one", "two", "three", "four"].map((content) =>
        createCard({ retrospectiveId: f.retroA.id, columnId: column.id, content }),
      ),
    );

    const first = await topLevelOrder(column.id);
    const second = await topLevelOrder(column.id);

    expect(first).toHaveLength(4);
    expect([...first].sort()).toEqual(["four", "one", "three", "two"]);
    expect(second).toEqual(first);
  });
});
