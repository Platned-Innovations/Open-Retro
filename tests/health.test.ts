import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/authz";
import { getHealthSummary, submitHealthCheckIn } from "@/server/retro/health";
import {
  HEALTH_DIMENSIONS,
  MIN_SUBMISSIONS_FOR_AVERAGE,
  MIN_SUBMISSIONS_FOR_DISTRIBUTION,
} from "@/lib/health";
import { asUser, seedFixture, seedGuidedRetro, type Fixture } from "./factory";

let f: Fixture;
let retro: Awaited<ReturnType<typeof seedGuidedRetro>>;

beforeEach(async () => {
  f = await seedFixture();
  retro = await seedGuidedRetro(f, { phase: "CHECK_IN" });
});

/** A complete answer sheet, since a partial one is refused by design. */
function scores(value: number) {
  return HEALTH_DIMENSIONS.map((dimension) => ({ dimension, value }));
}

/** Everyone on Project A1 plus enough extras to clear the thresholds. */
async function seedVoices(count: number, value = 3) {
  const people = [f.users.projA1Admin, f.users.projA1Member, f.users.projA1Other];
  for (let i = 0; i < count; i++) {
    let person = people[i];
    if (!person) {
      person = await prisma.user.create({
        data: { email: `extra${i}@example.test`, name: `extra${i}` },
        select: { id: true, email: true, name: true, role: true },
      });
      await prisma.projectMembership.create({
        data: { userId: person.id, projectId: f.projectA1.id, role: "MEMBER" },
      });
    }
    asUser(person);
    await submitHealthCheckIn({ retrospectiveId: retro.id, scores: scores(value) });
  }
}

describe("anonymity", () => {
  it("stores no user id against a submission", async () => {
    asUser(f.users.projA1Member);
    await submitHealthCheckIn({ retrospectiveId: retro.id, scores: scores(4) });

    const rows = await prisma.healthCheckIn.findMany();
    expect(rows).toHaveLength(1);
    // The whole design rests on this: even with the database in hand, the row
    // carries a per-retro HMAC and nothing that resolves to a person.
    expect(JSON.stringify(rows)).not.toContain(f.users.projA1Member.id);
    expect(Object.keys(rows[0])).not.toContain("userId");
  });

  /**
   * The salt is per retro, so the same person's key differs between boards.
   * A shared salt would let anyone with database access follow one person's
   * morale across a year of retrospectives.
   */
  it("gives the same person a different key on a different retro", async () => {
    const second = await seedGuidedRetro(f, { phase: "CHECK_IN" });

    asUser(f.users.projA1Member);
    await submitHealthCheckIn({ retrospectiveId: retro.id, scores: scores(4) });
    await submitHealthCheckIn({ retrospectiveId: second.id, scores: scores(4) });

    const keys = await prisma.healthCheckIn.findMany({ select: { participantKey: true } });
    expect(new Set(keys.map((k) => k.participantKey)).size).toBe(2);
  });

  it("returns no key and no identity in the summary payload", async () => {
    await seedVoices(MIN_SUBMISSIONS_FOR_AVERAGE);

    asUser(f.users.projA1Member);
    const summary = await getHealthSummary(retro.id);
    const payload = JSON.stringify(summary);

    const stored = await prisma.healthCheckIn.findMany({ select: { participantKey: true } });
    for (const { participantKey } of stored) expect(payload).not.toContain(participantKey);
    expect(payload).not.toContain(f.users.projA1Member.id);
    expect(payload).not.toContain("participantKey");
  });
});

describe("amending", () => {
  it("replaces a previous answer rather than adding a second voice", async () => {
    asUser(f.users.projA1Member);
    await submitHealthCheckIn({ retrospectiveId: retro.id, scores: scores(1) });
    await submitHealthCheckIn({ retrospectiveId: retro.id, scores: scores(5) });

    expect(await prisma.healthCheckIn.count()).toBe(1);
    const values = await prisma.healthScore.findMany({ select: { value: true } });
    expect(values).toHaveLength(HEALTH_DIMENSIONS.length);
    expect(values.every((v) => v.value === 5)).toBe(true);
  });

  it("hands someone back their own answers so they can amend them", async () => {
    asUser(f.users.projA1Member);
    await submitHealthCheckIn({ retrospectiveId: retro.id, scores: scores(2) });

    const mine = (await getHealthSummary(retro.id)).mine;
    expect(mine).toHaveLength(HEALTH_DIMENSIONS.length);
    expect(mine?.every((s) => s.value === 2)).toBe(true);

    // Someone else's summary must not carry them.
    asUser(f.users.projA1Other);
    expect((await getHealthSummary(retro.id)).mine).toBeNull();
  });
});

describe("k-anonymity", () => {
  it("reports nothing at all below the average threshold", async () => {
    await seedVoices(MIN_SUBMISSIONS_FOR_AVERAGE - 1);

    asUser(f.users.projA1Member);
    const summary = await getHealthSummary(retro.id);

    expect(summary.submitted).toBe(MIN_SUBMISSIONS_FOR_AVERAGE - 1);
    expect(summary.dimensions).toEqual([]);
    expect(summary.suppressedReason).toBeTruthy();
  });

  it("gives averages but withholds the shape at the lower threshold", async () => {
    await seedVoices(MIN_SUBMISSIONS_FOR_AVERAGE, 4);

    asUser(f.users.projA1Member);
    const summary = await getHealthSummary(retro.id);

    expect(summary.suppressedReason).toBeNull();
    expect(summary.dimensions).toHaveLength(HEALTH_DIMENSIONS.length);
    expect(summary.dimensions[0].average).toBeCloseTo(4, 5);
    // Five answers can hide an outlier; three cannot, so the distribution waits.
    expect(summary.dimensions.every((d) => d.distribution === null)).toBe(true);
  });

  it("releases the distribution once enough people have answered", async () => {
    await seedVoices(MIN_SUBMISSIONS_FOR_DISTRIBUTION, 2);

    asUser(f.users.projA1Member);
    const summary = await getHealthSummary(retro.id);

    const first = summary.dimensions[0];
    expect(first.distribution).not.toBeNull();
    // Everyone answered 2, so the whole population sits in the second bucket.
    expect(first.distribution?.[1]).toBe(MIN_SUBMISSIONS_FOR_DISTRIBUTION);
  });
});

describe("gates", () => {
  it("refuses a board that isn't running a check-in", async () => {
    await prisma.retrospective.update({
      where: { id: retro.id },
      data: { checkInEnabled: false },
    });

    asUser(f.users.projA1Member);
    await expect(
      submitHealthCheckIn({ retrospectiveId: retro.id, scores: scores(3) }),
    ).rejects.toThrow(ForbiddenError);
    expect(await prisma.healthCheckIn.count()).toBe(0);
  });

  it("refuses a participant outside the check-in step", async () => {
    const collecting = await seedGuidedRetro(f, { phase: "COLLECT" });

    asUser(f.users.projA1Member);
    await expect(
      submitHealthCheckIn({ retrospectiveId: collecting.id, scores: scores(3) }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("refuses someone outside the project", async () => {
    asUser(f.users.outsiderB);
    await expect(
      submitHealthCheckIn({ retrospectiveId: retro.id, scores: scores(3) }),
    ).rejects.toThrow();
    expect(await prisma.healthCheckIn.count()).toBe(0);
  });
});

describe("validation", () => {
  it("refuses a partial answer sheet", async () => {
    asUser(f.users.projA1Member);
    await expect(
      submitHealthCheckIn({
        retrospectiveId: retro.id,
        scores: scores(3).slice(0, 2),
      }),
    ).rejects.toThrow(BadRequestError);
  });

  it("refuses the same dimension twice", async () => {
    asUser(f.users.projA1Member);
    const duplicated = HEALTH_DIMENSIONS.map(() => ({ dimension: "MORALE" as const, value: 3 }));
    await expect(
      submitHealthCheckIn({ retrospectiveId: retro.id, scores: duplicated }),
    ).rejects.toThrow(BadRequestError);
  });

  it("refuses a score off the scale", async () => {
    asUser(f.users.projA1Member);
    await expect(
      submitHealthCheckIn({ retrospectiveId: retro.id, scores: scores(9) }),
    ).rejects.toThrow(BadRequestError);
    expect(await prisma.healthScore.count()).toBe(0);
  });
});
