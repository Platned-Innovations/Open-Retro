import "server-only";

/**
 * The scheduled work, as plain functions.
 *
 * Every job takes `now` rather than reading the clock, and returns what it
 * did. That is what makes them testable without a running server or a fake
 * timer: the loop in ./index.ts is the only thing that knows about time
 * passing, and it contains no business logic at all.
 *
 * Jobs never throw at the caller. A failing job must not take the others down
 * with it, and it certainly must not take down the web server it shares a
 * process with.
 */

import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email/graphMailer";
import { actionItemDueEmail } from "@/lib/email/templates";
import { UNRESOLVED_STATUSES } from "@/lib/actionItems";
import { USER_MAILABLE_SELECT } from "@/server/user-select";

/** How far ahead of the due date to nudge. */
const REMIND_AHEAD_MS = 24 * 60 * 60 * 1000;

/** One sweep should never try to mail the world, whatever state the data is in. */
const MAX_REMINDERS_PER_RUN = 100;

/**
 * Nudges assignees about action items that are due, or already overdue.
 *
 * **One email per action item, ever.** The marker is set whether or not any
 * mail was actually sent, so a daily sweep cannot turn into a daily nag. A
 * reminder people learn to filter is worse than no reminder, and the place to
 * see everything outstanding is /my-actions, which is always current and costs
 * nobody an inbox. A digest could be added later; it would be a separate job
 * with a separate marker, not this one running more often.
 *
 * Items with no assignee are marked as reminded without sending anything —
 * there is nobody to tell, and leaving them unmarked would mean re-querying
 * them forever.
 */
export async function sendDueDateReminders(now: Date): Promise<{ marked: number; emailed: number }> {
  const due = await prisma.actionItem.findMany({
    where: {
      dueReminderSentAt: null,
      dueDate: { not: null, lte: new Date(now.getTime() + REMIND_AHEAD_MS) },
      status: { in: [...UNRESOLVED_STATUSES] },
    },
    take: MAX_REMINDERS_PER_RUN,
    select: {
      id: true,
      description: true,
      dueDate: true,
      retrospectiveId: true,
      retrospective: { select: { title: true } },
      // Mailable, never returned anywhere — same rule as src/server/retro/notify.ts.
      assignees: { select: { user: USER_MAILABLE_SELECT } },
    },
  });

  if (due.length === 0) return { marked: 0, emailed: 0 };

  let emailed = 0;

  for (const item of due) {
    // Marked first. If the send fails we have logged it and moved on; if the
    // process dies between the send and the mark, the alternative ordering
    // re-sends the same email on the next sweep. Of the two failure modes, a
    // missed reminder is the kinder one.
    await prisma.actionItem.update({
      where: { id: item.id },
      data: { dueReminderSentAt: now },
    });

    const recipients = item.assignees.map((a) => a.user);
    if (recipients.length === 0 || !item.dueDate) continue;

    const { subject, html } = actionItemDueEmail({
      url: `${process.env.APP_URL}/my-actions`,
      retroTitle: item.retrospective.title,
      description: item.description,
      dueDate: item.dueDate,
      overdue: item.dueDate.getTime() < now.getTime(),
    });

    await Promise.all(
      recipients.map((r) =>
        sendMail({ to: r.email, subject, html })
          .then(() => {
            emailed += 1;
          })
          .catch((error) => console.error("Failed to send due-date reminder:", error)),
      ),
    );
  }

  return { marked: due.length, emailed };
}

/**
 * Deletes login tokens that can no longer be used.
 *
 * They are single-use and short-lived, so a used or expired row is dead weight
 * that only grows — every sign-in attempt leaves one behind. Nothing reads
 * them after the fact.
 */
export async function purgeDeadLoginTokens(now: Date): Promise<number> {
  const { count } = await prisma.loginToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] },
  });
  return count;
}

/**
 * Deletes invitations that expired without being accepted.
 *
 * Accepted ones are kept: `acceptedAt` is the only record of how somebody came
 * to be in a company, and deleting that to save a row would be trading an
 * audit trail for nothing.
 */
export async function purgeExpiredInvitations(now: Date): Promise<number> {
  const { count } = await prisma.invitation.deleteMany({
    where: { expiresAt: { lt: now }, acceptedAt: null },
  });
  return count;
}
