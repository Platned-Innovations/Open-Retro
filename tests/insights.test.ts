import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/authz";
import { getProjectInsights } from "@/server/queries/insights";
import { asUser, seedCard, seedFixture, seedVote, type Fixture } from "./factory";

let f: Fixture;
beforeEach(async () => {
  f = await seedFixture();
});

async function seedActionItem(input: {
  retrospectiveId: string;
  description: string;
  status?: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "DROPPED";
  createdAt?: Date;
  completedAt?: Date;
}) {
  return prisma.actionItem.create({
    data: {
      retrospectiveId: input.retrospectiveId,
      description: input.description,
      createdById: f.users.projA1Member.id,
      status: input.status ?? "OPEN",
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      completedAt: input.completedAt,
    },
  });
}

describe("access", () => {
  it("refuses someone outside the project", async () => {
    asUser(f.users.outsiderB);
    await expect(getProjectInsights({ projectId: f.projectA1.id })).rejects.toThrow(ForbiddenError);
  });

  it("admits a member", async () => {
    asUser(f.users.projA1Member);
    await expect(getProjectInsights({ projectId: f.projectA1.id })).resolves.toBeTruthy();
  });
});

describe("scoping", () => {
  /**
   * The point of resolving retro ids from the authorized project first: an
   * aggregate must never reach a board in another company.
   */
  it("counts only this project's retros", async () => {
    await seedCard(f.retroB, { authorId: f.users.outsiderB.id, content: "another company" });

    asUser(f.users.projA1Member);
    const insights = await getProjectInsights({ projectId: f.projectA1.id });

    // retroA and anonRetroA, not retroB.
    expect(insights.retros).toHaveLength(2);
    expect(insights.retros.every((r) => r.id !== f.retroB.id)).toBe(true);
  });
});

describe("participation", () => {
  it("counts the people who actually turned up", async () => {
    await prisma.retroParticipant.createMany({
      data: [
        { retrospectiveId: f.retroA.id, userId: f.users.projA1Member.id },
        { retrospectiveId: f.retroA.id, userId: f.users.projA1Other.id },
      ],
    });

    asUser(f.users.projA1Member);
    const insights = await getProjectInsights({ projectId: f.projectA1.id });
    const retroA = insights.retros.find((r) => r.id === f.retroA.id);

    expect(retroA?.participantCount).toBe(2);
    expect(insights.memberCount).toBe(3); // admin, member, other
  });
});

describe("action item outcomes", () => {
  it("rates completion, excluding dropped work", async () => {
    await seedActionItem({ retrospectiveId: f.retroA.id, description: "a", status: "DONE" });
    await seedActionItem({ retrospectiveId: f.retroA.id, description: "b", status: "DONE" });
    await seedActionItem({ retrospectiveId: f.retroA.id, description: "c", status: "OPEN" });
    await seedActionItem({ retrospectiveId: f.retroA.id, description: "d", status: "OPEN" });
    // Dropped is deliberately not counted against the team.
    await seedActionItem({ retrospectiveId: f.retroA.id, description: "e", status: "DROPPED" });

    asUser(f.users.projA1Member);
    const insights = await getProjectInsights({ projectId: f.projectA1.id });

    expect(insights.completionRate).toBe(0.5);
    expect(insights.actionsByStatus.DROPPED).toBe(1);
  });

  it("reports no rate at all when there is nothing to rate", async () => {
    asUser(f.users.projA1Member);
    const insights = await getProjectInsights({ projectId: f.projectA1.id });
    expect(insights.completionRate).toBeNull();
  });

  it("takes the median time to close, not the mean", async () => {
    const day = 86_400_000;
    const base = new Date(Date.now() - 100 * day);
    // 2, 4 and 30 days. The mean would be 12; the median is 4, which describes
    // the team better than one outlier does.
    await seedActionItem({
      retrospectiveId: f.retroA.id,
      description: "quick",
      status: "DONE",
      createdAt: base,
      completedAt: new Date(base.getTime() + 2 * day),
    });
    await seedActionItem({
      retrospectiveId: f.retroA.id,
      description: "normal",
      status: "DONE",
      createdAt: base,
      completedAt: new Date(base.getTime() + 4 * day),
    });
    await seedActionItem({
      retrospectiveId: f.retroA.id,
      description: "dragged",
      status: "DONE",
      createdAt: base,
      completedAt: new Date(base.getTime() + 30 * day),
    });

    asUser(f.users.projA1Member);
    const insights = await getProjectInsights({ projectId: f.projectA1.id });
    expect(insights.medianDaysToClose).toBeCloseTo(4, 1);
  });

  it("counts carried-over work, and how much of it is still outstanding", async () => {
    const stillOpen = await seedActionItem({
      retrospectiveId: f.retroA.id,
      description: "keeps coming back",
    });
    const finished = await seedActionItem({
      retrospectiveId: f.retroA.id,
      description: "eventually done",
      status: "DONE",
    });
    await prisma.retroCarryOver.createMany({
      data: [
        { retrospectiveId: f.anonRetroA.id, actionItemId: stillOpen.id },
        { retrospectiveId: f.anonRetroA.id, actionItemId: finished.id },
      ],
    });

    asUser(f.users.projA1Member);
    const insights = await getProjectInsights({ projectId: f.projectA1.id });

    expect(insights.carriedOverCount).toBe(2);
    expect(insights.stalledCount).toBe(1);
  });
});

describe("board sentiment", () => {
  it("scores a board from the sentiment of the columns its cards are in", async () => {
    // The fixture uses Start/Stop/Keep: start doing and keep doing are
    // POSITIVE, stop doing is NEGATIVE.
    const [start, stop] = f.retroA.columns;
    await seedCard(f.retroA, { authorId: f.users.projA1Member.id, content: "good 1", columnIndex: 0 });
    await seedCard(f.retroA, { authorId: f.users.projA1Member.id, content: "good 2", columnIndex: 0, order: 1 });
    await seedCard(f.retroA, { authorId: f.users.projA1Member.id, content: "bad 1", columnIndex: 1 });

    expect(start.id).toBeTruthy();
    expect(stop.id).toBeTruthy();

    asUser(f.users.projA1Member);
    const insights = await getProjectInsights({ projectId: f.projectA1.id });
    const retroA = insights.retros.find((r) => r.id === f.retroA.id);

    // (2 positive - 1 negative) / 3
    expect(retroA?.sentimentScore).toBeCloseTo(1 / 3, 5);
  });

  it("reports no score when a board has no sentiment-bearing cards", async () => {
    asUser(f.users.projA1Member);
    const insights = await getProjectInsights({ projectId: f.projectA1.id });
    expect(insights.retros.every((r) => r.sentimentScore === null)).toBe(true);
  });
});

describe("votes", () => {
  it("counts votes per retro", async () => {
    const card = await seedCard(f.retroA, {
      authorId: f.users.projA1Member.id,
      content: "a card",
    });
    await seedVote(f.retroA, card.id, f.users.projA1Member.id);
    await seedVote(f.retroA, card.id, f.users.projA1Other.id);

    asUser(f.users.projA1Member);
    const insights = await getProjectInsights({ projectId: f.projectA1.id });
    expect(insights.retros.find((r) => r.id === f.retroA.id)?.voteCount).toBe(2);
  });
});

describe("themes", () => {
  it("finds wording that recurs across boards", async () => {
    await seedCard(f.retroA, {
      authorId: f.users.projA1Member.id,
      content: "the deployment pipeline is slow",
    });
    await seedCard(f.anonRetroA, {
      authorId: f.users.projA1Member.id,
      content: "deployment pipeline broke again",
    });

    asUser(f.users.projA1Member);
    const insights = await getProjectInsights({ projectId: f.projectA1.id });

    expect(insights.themes.map((t) => t.term)).toContain("deployment pipeline");
  });

  /** Themes read card content, so they must not become a way round anonymity. */
  it("returns no author information alongside the terms", async () => {
    await seedCard(f.anonRetroA, {
      authorId: f.users.projA1Other.id,
      content: "shared concern here",
    });
    await seedCard(f.retroA, {
      authorId: f.users.projA1Other.id,
      content: "shared concern again",
    });

    asUser(f.users.projA1Member);
    const insights = await getProjectInsights({ projectId: f.projectA1.id });
    const payload = JSON.stringify(insights);

    expect(payload).not.toContain("projA1Other");
    expect(payload).not.toContain("authorId");
  });
});

describe("team health trend", () => {
  /** Answers for one retro, from `count` distinct anonymous participants. */
  async function seedCheckIns(retrospectiveId: string, count: number, value: number) {
    for (let i = 0; i < count; i++) {
      await prisma.healthCheckIn.create({
        data: {
          retrospectiveId,
          participantKey: `key-${retrospectiveId}-${i}`,
          scores: {
            create: [
              { retrospectiveId, dimension: "MORALE" as const, value },
              { retrospectiveId, dimension: "DELIVERY" as const, value },
            ],
          },
        },
      });
    }
  }

  it("averages the retros that cleared the threshold", async () => {
    await seedCheckIns(f.retroA.id, 3, 4);

    asUser(f.users.projA1Member);
    const insights = await getProjectInsights({ projectId: f.projectA1.id });

    const morale = insights.health.trends.find((t) => t.dimension === "MORALE");
    expect(morale?.points).toHaveLength(1);
    expect(morale?.points[0].average).toBeCloseTo(4, 5);
    expect(insights.health.suppressedRetros).toBe(0);
  });

  /**
   * The threshold has to hold here too. Aggregating across retros would
   * otherwise be a way straight round a rule the board itself enforces.
   */
  it("drops a retro that had too few answers, rather than plotting it", async () => {
    await seedCheckIns(f.retroA.id, 3, 5);
    await seedCheckIns(f.anonRetroA.id, 2, 1);

    asUser(f.users.projA1Member);
    const insights = await getProjectInsights({ projectId: f.projectA1.id });

    const morale = insights.health.trends.find((t) => t.dimension === "MORALE");
    expect(morale?.points).toHaveLength(1);
    expect(morale?.points[0].retroId).toBe(f.retroA.id);
    // Counted, so the caption can admit the series has a gap in it.
    expect(insights.health.suppressedRetros).toBe(1);
  });

  it("reports no trend at all when nobody checked in", async () => {
    asUser(f.users.projA1Member);
    const insights = await getProjectInsights({ projectId: f.projectA1.id });
    expect(insights.health.trends).toEqual([]);
    expect(insights.health.suppressedRetros).toBe(0);
  });
});

describe("empty project", () => {
  it("returns a usable shape rather than throwing", async () => {
    asUser(f.users.projA2Member);
    const insights = await getProjectInsights({ projectId: f.projectA2.id });

    expect(insights.retros).toEqual([]);
    expect(insights.completionRate).toBeNull();
    expect(insights.themes).toEqual([]);
  });
});
