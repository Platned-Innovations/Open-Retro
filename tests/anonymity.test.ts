import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getRetroBoard } from "@/server/queries/retros";
import { asUser, seedCard, seedFixture, seedVote, type Fixture } from "./factory";

let f: Fixture;
beforeEach(async () => {
  f = await seedFixture();
});

/**
 * Walks an arbitrary structure and collects every property name in it.
 *
 * Asserting on key *names* rather than on values is deliberate: the leak was
 * never a visible name, it was `authorId` sitting in the payload next to a
 * member list that mapped ids to names. Anything shaped like a user id is
 * therefore the thing to ban, wherever it appears and whatever it is called on
 * the way in.
 */
function collectKeys(value: unknown, into = new Set<string>()): Set<string> {
  if (value === null || typeof value !== "object") return into;
  if (value instanceof Date) return into;
  if (Array.isArray(value)) {
    for (const entry of value) collectKeys(entry, into);
    return into;
  }
  for (const [key, child] of Object.entries(value)) {
    into.add(key);
    collectKeys(child, into);
  }
  return into;
}

async function seedAnonymousBoard() {
  const mine = await seedCard(f.anonRetroA, {
    authorId: f.users.projA1Member.id,
    content: "my card",
    order: 0,
  });
  const theirs = await seedCard(f.anonRetroA, {
    authorId: f.users.projA1Other.id,
    content: "their card",
    order: 1,
  });
  // A self-vote and a reaction: the correlation that made redacting only the
  // author name pointless, since CardVote carried a plain userId.
  await seedVote(f.anonRetroA, theirs.id, f.users.projA1Other.id);
  await prisma.reaction.create({
    data: { cardId: theirs.id, userId: f.users.projA1Other.id, emoji: "👍" },
  });
  await prisma.comment.create({
    data: { cardId: theirs.id, authorId: f.users.projA1Other.id, content: "their comment" },
  });
  return { mine, theirs };
}

describe("anonymous retrospectives", () => {
  it("never ships an author id, a voter id, or a member lookup table", async () => {
    await seedAnonymousBoard();
    asUser(f.users.projA1Member);

    const board = await getRetroBoard(f.anonRetroA.id);
    const keys = collectKeys(board);

    expect(keys).not.toContain("authorId");
    expect(keys).not.toContain("userId");
    expect(keys).not.toContain("facilitatorId");
    expect(keys).not.toContain("createdById");
    // The id->name table that made the join trivial.
    expect(keys).not.toContain("memberships");

    // The board still carries a flat list of project members, because the
    // assignee picker and @mention matching need names. That is not a leak on
    // its own — those names are already public on the project page — and with
    // no author id anywhere there is nothing left to join them against. What
    // must hold is that the *content* subtree names nobody but the viewer.
    const contentKeys = collectKeys(board.columns);
    expect(contentKeys).not.toContain("authorId");
    expect(contentKeys).not.toContain("userId");
    expect(JSON.stringify(board.columns)).not.toContain("projA1Other");
  });

  it("still tells the viewer which cards are their own", async () => {
    await seedAnonymousBoard();
    asUser(f.users.projA1Member);

    const board = await getRetroBoard(f.anonRetroA.id);
    const cards = board.columns[0].cards;

    const mine = cards.find((c) => c.content === "my card");
    const theirs = cards.find((c) => c.content === "their card");

    expect(mine?.isOwn).toBe(true);
    expect(mine?.authorName).toBe("projA1Member");
    expect(theirs?.isOwn).toBe(false);
    expect(theirs?.authorName).toBeNull();
  });

  it("redacts for moderators too", async () => {
    await seedAnonymousBoard();
    // The facilitator. Anonymous has to mean anonymous to everyone, or it is
    // just a display preference.
    asUser(f.users.projA1Admin);

    const board = await getRetroBoard(f.anonRetroA.id);
    const theirs = board.columns[0].cards.find((c) => c.content === "their card");

    expect(theirs?.authorName).toBeNull();
    expect(JSON.stringify(board.columns)).not.toContain("projA1Other");
  });

  it("reports vote and reaction counts without saying who cast them", async () => {
    const { theirs } = await seedAnonymousBoard();
    asUser(f.users.projA1Member);

    const board = await getRetroBoard(f.anonRetroA.id);
    const card = board.columns[0].cards.find((c) => c.id === theirs.id);

    expect(card?.voteCount).toBe(1);
    expect(card?.hasVoted).toBe(false);
    expect(card?.reactions).toEqual([{ emoji: "👍", count: 1, mine: false }]);
  });

  it("redacts comment authors as well as card authors", async () => {
    await seedAnonymousBoard();
    asUser(f.users.projA1Member);

    const board = await getRetroBoard(f.anonRetroA.id);
    const theirs = board.columns[0].cards.find((c) => c.content === "their card");

    expect(theirs?.comments[0]?.content).toBe("their comment");
    expect(theirs?.comments[0]?.authorName).toBeNull();
    expect(theirs?.comments[0]?.isOwn).toBe(false);
  });
});

describe("non-anonymous retrospectives", () => {
  it("show author names, and still ship no user ids", async () => {
    await seedCard(f.retroA, { authorId: f.users.projA1Other.id, content: "attributed" });
    asUser(f.users.projA1Member);

    const board = await getRetroBoard(f.retroA.id);
    const card = board.columns[0].cards[0];

    expect(card.authorName).toBe("projA1Other");
    expect(card.isOwn).toBe(false);

    // The same projection either way — one code path, so redaction cannot be
    // forgotten for the anonymous case.
    const keys = collectKeys(board);
    expect(keys).not.toContain("authorId");
    expect(keys).not.toContain("userId");
  });
});
