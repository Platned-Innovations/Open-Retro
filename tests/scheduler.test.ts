import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email/graphMailer";
import { startScheduler } from "@/server/scheduler";
import {
  purgeDeadLoginTokens,
  purgeExpiredInvitations,
  sendDueDateReminders,
} from "@/server/scheduler/jobs";
import { seedFixture, type Fixture } from "./factory";

const DAY = 86_400_000;
const NOW = new Date("2026-09-20T09:00:00.000Z");

let f: Fixture;
beforeEach(async () => {
  f = await seedFixture();
});

async function seedActionItem(input: {
  description: string;
  dueDate?: Date | null;
  status?: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "DROPPED";
  assigneeIds?: string[];
  dueReminderSentAt?: Date;
}) {
  return prisma.actionItem.create({
    data: {
      retrospectiveId: f.retroA.id,
      description: input.description,
      createdById: f.users.projA1Admin.id,
      status: input.status ?? "OPEN",
      dueDate: input.dueDate ?? null,
      dueReminderSentAt: input.dueReminderSentAt,
      assignees: input.assigneeIds
        ? { create: input.assigneeIds.map((userId) => ({ userId })) }
        : undefined,
    },
  });
}

describe("due-date reminders", () => {
  it("emails the assignees of an overdue item", async () => {
    await seedActionItem({
      description: "overdue",
      dueDate: new Date(NOW.getTime() - 3 * DAY),
      assigneeIds: [f.users.projA1Member.id, f.users.projA1Other.id],
    });

    const result = await sendDueDateReminders(NOW);

    expect(result).toEqual({ marked: 1, emailed: 2 });
    expect(vi.mocked(sendMail)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(sendMail).mock.calls[0][0].subject).toContain("Overdue");
  });

  it("nudges ahead of the deadline, not only after it", async () => {
    await seedActionItem({
      description: "due tomorrow",
      dueDate: new Date(NOW.getTime() + 2 * 3600_000),
      assigneeIds: [f.users.projA1Member.id],
    });

    await sendDueDateReminders(NOW);
    expect(vi.mocked(sendMail).mock.calls[0][0].subject).toContain("due soon");
  });

  it("leaves an item that isn't due yet alone", async () => {
    await seedActionItem({
      description: "next week",
      dueDate: new Date(NOW.getTime() + 7 * DAY),
      assigneeIds: [f.users.projA1Member.id],
    });

    expect(await sendDueDateReminders(NOW)).toEqual({ marked: 0, emailed: 0 });
    expect(vi.mocked(sendMail)).not.toHaveBeenCalled();
  });

  /** The whole point of the marker: a sweep every 15 minutes must not nag. */
  it("never emails the same item twice, however often it runs", async () => {
    await seedActionItem({
      description: "overdue",
      dueDate: new Date(NOW.getTime() - DAY),
      assigneeIds: [f.users.projA1Member.id],
    });

    await sendDueDateReminders(NOW);
    await sendDueDateReminders(new Date(NOW.getTime() + DAY));
    await sendDueDateReminders(new Date(NOW.getTime() + 30 * DAY));

    expect(vi.mocked(sendMail)).toHaveBeenCalledTimes(1);
  });

  it("says nothing about work that is already finished", async () => {
    await seedActionItem({
      description: "done",
      status: "DONE",
      dueDate: new Date(NOW.getTime() - DAY),
      assigneeIds: [f.users.projA1Member.id],
    });
    await seedActionItem({
      description: "dropped",
      status: "DROPPED",
      dueDate: new Date(NOW.getTime() - DAY),
      assigneeIds: [f.users.projA1Member.id],
    });

    expect(await sendDueDateReminders(NOW)).toEqual({ marked: 0, emailed: 0 });
  });

  it("ignores an item with no due date at all", async () => {
    await seedActionItem({ description: "someday", assigneeIds: [f.users.projA1Member.id] });
    expect(await sendDueDateReminders(NOW)).toEqual({ marked: 0, emailed: 0 });
  });

  /**
   * Nobody to tell, but it still has to be marked — otherwise the sweep
   * re-reads the same rows on every tick forever.
   */
  it("marks an unassigned item without emailing anyone", async () => {
    await seedActionItem({ description: "nobody owns this", dueDate: new Date(NOW.getTime() - DAY) });

    expect(await sendDueDateReminders(NOW)).toEqual({ marked: 1, emailed: 0 });
    expect(vi.mocked(sendMail)).not.toHaveBeenCalled();

    const item = await prisma.actionItem.findFirstOrThrow();
    expect(item.dueReminderSentAt).not.toBeNull();
  });

  /** A Graph outage must not make the sweep retry the same item forever. */
  it("still marks an item whose email failed", async () => {
    vi.mocked(sendMail).mockRejectedValueOnce(new Error("Graph is down"));
    await seedActionItem({
      description: "send fails",
      dueDate: new Date(NOW.getTime() - DAY),
      assigneeIds: [f.users.projA1Member.id],
    });

    await sendDueDateReminders(NOW);

    const item = await prisma.actionItem.findFirstOrThrow();
    expect(item.dueReminderSentAt).not.toBeNull();
  });
});

describe("cleanup", () => {
  it("deletes login tokens that are spent or expired, and keeps live ones", async () => {
    await prisma.loginToken.createMany({
      data: [
        { userId: f.users.projA1Member.id, tokenHash: "expired", expiresAt: new Date(NOW.getTime() - DAY) },
        {
          userId: f.users.projA1Member.id,
          tokenHash: "used",
          expiresAt: new Date(NOW.getTime() + DAY),
          usedAt: new Date(NOW.getTime() - 3600_000),
        },
        { userId: f.users.projA1Member.id, tokenHash: "live", expiresAt: new Date(NOW.getTime() + DAY) },
      ],
    });

    expect(await purgeDeadLoginTokens(NOW)).toBe(2);
    const left = await prisma.loginToken.findMany({ select: { tokenHash: true } });
    expect(left.map((t) => t.tokenHash)).toEqual(["live"]);
  });

  /**
   * `acceptedAt` is the only record of how somebody came to be in a company.
   * Deleting it to reclaim a row would trade an audit trail for nothing.
   */
  it("keeps an accepted invitation even once it has expired", async () => {
    await prisma.invitation.createMany({
      data: [
        {
          email: "lapsed@example.test",
          companyId: f.companyA.id,
          invitedById: f.users.coAAdmin.id,
          expiresAt: new Date(NOW.getTime() - DAY),
        },
        {
          email: "accepted@example.test",
          companyId: f.companyA.id,
          invitedById: f.users.coAAdmin.id,
          expiresAt: new Date(NOW.getTime() - DAY),
          acceptedAt: new Date(NOW.getTime() - 2 * DAY),
        },
        {
          email: "pending@example.test",
          companyId: f.companyA.id,
          invitedById: f.users.coAAdmin.id,
          expiresAt: new Date(NOW.getTime() + DAY),
        },
      ],
    });

    expect(await purgeExpiredInvitations(NOW)).toBe(1);
    const left = await prisma.invitation.findMany({ select: { email: true }, orderBy: { email: "asc" } });
    expect(left.map((i) => i.email)).toEqual(["accepted@example.test", "pending@example.test"]);
  });
});

describe("refusing to start", () => {
  /**
   * The guard exists because of a real incident: a throwaway boot check with
   * APP_URL=https://example.invalid was left running against the live database
   * and, fifteen minutes later, mailed a real person a dead link.
   */
  const ORIGINAL_APP_URL = process.env.APP_URL;
  afterEach(() => {
    process.env.APP_URL = ORIGINAL_APP_URL;
  });

  it.each([
    ["unset", undefined],
    ["localhost", "http://localhost:3000"],
    ["a loopback address", "http://127.0.0.1:3000"],
    ["a reserved .invalid host", "https://example.invalid"],
    ["a reserved .test host", "https://retro.test"],
  ])("refuses when APP_URL is %s", (_label, value) => {
    if (value === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = value;

    expect(startScheduler()).toBe(false);
  });

  it("starts when APP_URL is a real host", () => {
    process.env.APP_URL = "https://retro.platned.com";
    expect(startScheduler()).toBe(true);
  });
});
