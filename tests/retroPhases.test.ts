import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/authz";
import { createCard, toggleVote } from "@/server/retro/cards";
import { configureRetroFlow, setRetroPhase, stepRetroPhase } from "@/server/retro/phases";
import { createRetrospective } from "@/server/retro/lifecycle";
import { getRetroBoard } from "@/server/queries/retros";
import { asUser, seedCard, seedFixture, seedGuidedRetro, type Fixture } from "./factory";

let f: Fixture;
beforeEach(async () => {
  f = await seedFixture();
});

describe("phase gating", () => {
  it("refuses to add a card outside COLLECT, and says why", async () => {
    const retro = await seedGuidedRetro(f, { phase: "VOTE" });
    asUser(f.users.projA1Member);

    await expect(
      createCard({
        retrospectiveId: retro.id,
        columnId: retro.columns[0].id,
        content: "too late",
      }),
    ).rejects.toThrow(/Vote is in progress/);

    expect(await prisma.retroCard.count()).toBe(0);
  });

  it("allows adding a card during COLLECT", async () => {
    const retro = await seedGuidedRetro(f, { phase: "COLLECT" });
    asUser(f.users.projA1Member);

    await expect(
      createCard({ retrospectiveId: retro.id, columnId: retro.columns[0].id, content: "on time" }),
    ).resolves.toBeTruthy();
  });

  it("refuses to vote outside VOTE", async () => {
    const retro = await seedGuidedRetro(f, { phase: "COLLECT" });
    const card = await seedCard(retro, { authorId: f.users.projA1Member.id, content: "a card" });
    asUser(f.users.projA1Member);

    await expect(toggleVote(retro.id, card.id)).rejects.toThrow(ForbiddenError);
    expect(await prisma.cardVote.count()).toBe(0);
  });

  /**
   * A facilitator fixing a typo mid-session shouldn't have to rewind the whole
   * group to do it. This is the one deliberate hole in the gate.
   */
  it("lets a moderator act out of phase", async () => {
    const retro = await seedGuidedRetro(f, { phase: "VOTE" });
    asUser(f.users.projA1Admin);

    await expect(
      createCard({ retrospectiveId: retro.id, columnId: retro.columns[0].id, content: "moderator" }),
    ).resolves.toBeTruthy();
  });

  /** A retro from before the engine, or one deliberately run freeform. */
  it("gates nothing on an ungated retro", async () => {
    asUser(f.users.projA1Member);
    await expect(
      createCard({
        retrospectiveId: f.retroA.id,
        columnId: f.retroA.columns[0].id,
        content: "freeform",
      }),
    ).resolves.toBeTruthy();
  });
});

describe("advancing the flow", () => {
  it("steps forward into the check-in", async () => {
    const retro = await seedGuidedRetro(f, { phase: "LOBBY" });
    asUser(f.users.projA1Admin);

    await stepRetroPhase({ retrospectiveId: retro.id, direction: "next" });
    const after = await prisma.retrospective.findUniqueOrThrow({ where: { id: retro.id } });
    expect(after.phase).toBe("CHECK_IN");
  });

  /** A team that turned the check-in off never lands on a step that does nothing. */
  it("skips CHECK_IN when it is disabled", async () => {
    const retro = await seedGuidedRetro(f, { phase: "LOBBY", checkInEnabled: false });
    asUser(f.users.projA1Admin);

    await stepRetroPhase({ retrospectiveId: retro.id, direction: "next" });
    const after = await prisma.retrospective.findUniqueOrThrow({ where: { id: retro.id } });
    expect(after.phase).toBe("COLLECT");
  });

  it("refuses to let a plain member advance the session", async () => {
    const retro = await seedGuidedRetro(f, { phase: "LOBBY" });
    asUser(f.users.projA1Member);

    await expect(
      stepRetroPhase({ retrospectiveId: retro.id, direction: "next" }),
    ).rejects.toThrow(ForbiddenError);
  });

  /**
   * Two moderators both clicking "Next" must advance one step, not two. The
   * second click is reported as success, because from that person's point of
   * view the board did go where they asked.
   */
  it("does not double-advance when two moderators click at once", async () => {
    const retro = await seedGuidedRetro(f, { phase: "COLLECT" });
    asUser(f.users.projA1Admin);

    const [first, second] = await Promise.all([
      setRetroPhase({ retrospectiveId: retro.id, to: "GROUP", from: "COLLECT" }),
      setRetroPhase({ retrospectiveId: retro.id, to: "GROUP", from: "COLLECT" }),
    ]);

    const after = await prisma.retrospective.findUniqueOrThrow({ where: { id: retro.id } });
    expect(after.phase).toBe("GROUP");
    expect([first.alreadyThere, second.alreadyThere].filter(Boolean)).toHaveLength(1);
  });

  it("closes the retro and its status together", async () => {
    const retro = await seedGuidedRetro(f, { phase: "ACTIONS" });
    asUser(f.users.projA1Admin);

    await setRetroPhase({ retrospectiveId: retro.id, to: "CLOSED", from: "ACTIONS" });
    const after = await prisma.retrospective.findUniqueOrThrow({ where: { id: retro.id } });

    expect(after.phase).toBe("CLOSED");
    expect(after.status).toBe("COMPLETED");
    expect(after.endedAt).not.toBeNull();
  });
});

describe("safe ideation", () => {
  it("never fetches anyone else's cards during COLLECT", async () => {
    const retro = await seedGuidedRetro(f, { phase: "COLLECT", hideOthersCards: true });
    await seedCard(retro, { authorId: f.users.projA1Member.id, content: "mine", order: 0 });
    await seedCard(retro, { authorId: f.users.projA1Other.id, content: "theirs", order: 1 });

    asUser(f.users.projA1Member);
    const board = await getRetroBoard(retro.id);
    const payload = JSON.stringify(board);

    expect(payload).toContain("mine");
    expect(payload).not.toContain("theirs");
    expect(board.columns[0].hiddenCardCount).toBe(1);
  });

  /** Anchoring doesn't spare the person running the session. */
  it("hides other people's cards from the facilitator too", async () => {
    const retro = await seedGuidedRetro(f, { phase: "COLLECT", hideOthersCards: true });
    await seedCard(retro, { authorId: f.users.projA1Member.id, content: "theirs", order: 0 });

    asUser(f.users.projA1Admin);
    const board = await getRetroBoard(retro.id);

    expect(JSON.stringify(board)).not.toContain("theirs");
  });

  it("reveals everything once the retro leaves COLLECT", async () => {
    const retro = await seedGuidedRetro(f, { phase: "COLLECT", hideOthersCards: true });
    await seedCard(retro, { authorId: f.users.projA1Other.id, content: "theirs", order: 0 });

    asUser(f.users.projA1Admin);
    await setRetroPhase({ retrospectiveId: retro.id, to: "GROUP", from: "COLLECT" });

    asUser(f.users.projA1Member);
    const board = await getRetroBoard(retro.id);
    expect(JSON.stringify(board)).toContain("theirs");
  });

  /**
   * The latch. Words that have been read cannot be un-read, so going back to
   * COLLECT must not claim to hide them again.
   */
  it("stays revealed after going back to COLLECT", async () => {
    const retro = await seedGuidedRetro(f, { phase: "COLLECT", hideOthersCards: true });
    await seedCard(retro, { authorId: f.users.projA1Other.id, content: "theirs", order: 0 });

    asUser(f.users.projA1Admin);
    await setRetroPhase({ retrospectiveId: retro.id, to: "GROUP", from: "COLLECT" });
    await setRetroPhase({ retrospectiveId: retro.id, to: "COLLECT", from: "GROUP" });

    asUser(f.users.projA1Member);
    const board = await getRetroBoard(retro.id);
    expect(JSON.stringify(board)).toContain("theirs");
    expect(board.canHideCards).toBe(false);
  });

  it("refuses to re-enable hiding once revealed, rather than silently ignoring it", async () => {
    const retro = await seedGuidedRetro(f, { phase: "COLLECT", hideOthersCards: true });
    asUser(f.users.projA1Admin);
    await setRetroPhase({ retrospectiveId: retro.id, to: "GROUP", from: "COLLECT" });

    await expect(
      configureRetroFlow({ retrospectiveId: retro.id, hideOthersCards: true }),
    ).rejects.toThrow(/already been revealed/);
  });
});

describe("vote budget", () => {
  it("refuses the vote that would exceed the budget", async () => {
    const retro = await seedGuidedRetro(f, { phase: "VOTE", voteBudget: 2 });
    const cards = await Promise.all(
      ["a", "b", "c"].map((content, i) =>
        seedCard(retro, { authorId: f.users.projA1Member.id, content, order: i }),
      ),
    );
    asUser(f.users.projA1Member);

    await toggleVote(retro.id, cards[0].id);
    await toggleVote(retro.id, cards[1].id);
    await expect(toggleVote(retro.id, cards[2].id)).rejects.toThrow(/all 2 of your votes/);

    expect(await prisma.cardVote.count({ where: { retrospectiveId: retro.id } })).toBe(2);
  });

  it("frees a vote up when one is taken back", async () => {
    const retro = await seedGuidedRetro(f, { phase: "VOTE", voteBudget: 1 });
    const [a, b] = await Promise.all([
      seedCard(retro, { authorId: f.users.projA1Member.id, content: "a", order: 0 }),
      seedCard(retro, { authorId: f.users.projA1Member.id, content: "b", order: 1 }),
    ]);
    asUser(f.users.projA1Member);

    await toggleVote(retro.id, a.id);
    await expect(toggleVote(retro.id, b.id)).rejects.toThrow(ForbiddenError);

    await toggleVote(retro.id, a.id); // take it back
    await expect(toggleVote(retro.id, b.id)).resolves.toBeUndefined();
  });

  /** Two tabs must not each read "budget remaining" and both spend the last one. */
  it("holds the budget under concurrent votes", async () => {
    const retro = await seedGuidedRetro(f, { phase: "VOTE", voteBudget: 1 });
    const [a, b] = await Promise.all([
      seedCard(retro, { authorId: f.users.projA1Member.id, content: "a", order: 0 }),
      seedCard(retro, { authorId: f.users.projA1Member.id, content: "b", order: 1 }),
    ]);
    asUser(f.users.projA1Member);

    await Promise.allSettled([toggleVote(retro.id, a.id), toggleVote(retro.id, b.id)]);

    expect(await prisma.cardVote.count({ where: { retrospectiveId: retro.id } })).toBe(1);
  });

  it("reports how many votes are left", async () => {
    const retro = await seedGuidedRetro(f, { phase: "VOTE", voteBudget: 3 });
    const card = await seedCard(retro, { authorId: f.users.projA1Member.id, content: "a" });
    asUser(f.users.projA1Member);

    await toggleVote(retro.id, card.id);
    const board = await getRetroBoard(retro.id);
    expect(board.votesRemaining).toBe(2);
  });
});

describe("hidden tallies", () => {
  it("withholds the count during VOTE but still says whether you voted", async () => {
    const retro = await seedGuidedRetro(f, { phase: "VOTE", voteBudget: 5, hideVoteCounts: true });
    const card = await seedCard(retro, { authorId: f.users.projA1Other.id, content: "a card" });
    asUser(f.users.projA1Member);

    await toggleVote(retro.id, card.id);
    const board = await getRetroBoard(retro.id);
    const seen = board.columns[0].cards[0];

    // null, not 0 — a nullable number cannot be rendered as a tally by accident.
    expect(seen.voteCount).toBeNull();
    expect(seen.hasVoted).toBe(true);
  });

  it("reveals the count once the group reaches DISCUSS", async () => {
    const retro = await seedGuidedRetro(f, { phase: "VOTE", voteBudget: 5, hideVoteCounts: true });
    const card = await seedCard(retro, { authorId: f.users.projA1Other.id, content: "a card" });
    asUser(f.users.projA1Member);
    await toggleVote(retro.id, card.id);

    asUser(f.users.projA1Admin);
    await setRetroPhase({ retrospectiveId: retro.id, to: "DISCUSS", from: "VOTE" });

    asUser(f.users.projA1Member);
    const board = await getRetroBoard(retro.id);
    expect(board.columns[0].cards[0].voteCount).toBe(1);
  });

  it("points the group at the top-voted card when DISCUSS begins", async () => {
    const retro = await seedGuidedRetro(f, { phase: "VOTE", voteBudget: 5 });
    const [quiet, popular] = await Promise.all([
      seedCard(retro, { authorId: f.users.projA1Member.id, content: "quiet", order: 0 }),
      seedCard(retro, { authorId: f.users.projA1Other.id, content: "popular", order: 1 }),
    ]);

    asUser(f.users.projA1Member);
    await toggleVote(retro.id, popular.id);
    asUser(f.users.projA1Other);
    await toggleVote(retro.id, popular.id);

    asUser(f.users.projA1Admin);
    await setRetroPhase({ retrospectiveId: retro.id, to: "DISCUSS", from: "VOTE" });

    const after = await prisma.retrospective.findUniqueOrThrow({ where: { id: retro.id } });
    expect(after.discussCardId).toBe(popular.id);
    expect(after.discussCardId).not.toBe(quiet.id);
  });
});

describe("creating a retro", () => {
  it("opens a guided retro in LOBBY, so people can arrive before anyone writes", async () => {
    asUser(f.users.projA1Member);
    const created = await createRetrospective({
      projectId: f.projectA1.id,
      title: "Guided",
      template: "START_STOP_CONTINUE",
      isGuided: true,
      voteBudget: 3,
    });

    expect(created.phase).toBe("LOBBY");
    expect(created.isGuided).toBe(true);
    expect(created.voteBudget).toBe(3);
  });

  it("opens an unguided retro straight in COLLECT, since it has no steps to wait for", async () => {
    asUser(f.users.projA1Member);
    const created = await createRetrospective({
      projectId: f.projectA1.id,
      title: "Freeform",
      template: "START_STOP_CONTINUE",
      isGuided: false,
    });

    expect(created.phase).toBe("COLLECT");
    expect(created.isGuided).toBe(false);
  });
});

describe("attendance", () => {
  it("records each viewer once", async () => {
    asUser(f.users.projA1Member);
    await getRetroBoard(f.retroA.id);
    await getRetroBoard(f.retroA.id);

    asUser(f.users.projA1Other);
    await getRetroBoard(f.retroA.id);

    const participants = await prisma.retroParticipant.findMany({
      where: { retrospectiveId: f.retroA.id },
    });
    expect(participants).toHaveLength(2);
  });
});
