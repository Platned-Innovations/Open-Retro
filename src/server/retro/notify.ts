import "server-only";

/**
 * Outgoing email for retro activity.
 *
 * Kept apart from the mutations so the rule is easy to hold: an address is
 * looked up here, at the point of sending, and never travels back out. The
 * mutations pass user *ids*; nothing they return or broadcast carries an email.
 *
 * Every send is fire-and-forget with a logged failure. That is a deliberate
 * limitation rather than an oversight — there is no queue, no retry and no
 * delivery record, so a Graph outage drops invitations silently. Fixing that
 * needs the scheduler the roadmap calls for; until then, failures are at least
 * visible in the log.
 */

import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email/graphMailer";
import {
  actionItemAssignedEmail,
  actionItemCompletedEmail,
  actionItemUnassignedEmail,
  mentionEmail,
} from "@/lib/email/templates";
import { extractMentionedUserIds } from "@/lib/mentions";
import { USER_MAILABLE_SELECT } from "@/server/user-select";

export async function notifyMentions(input: {
  retrospectiveId: string;
  content: string;
  authorId: string;
  authorName: string;
}) {
  const retro = await prisma.retrospective.findUnique({
    where: { id: input.retrospectiveId },
    // Mailable, not public: this result is only ever used to resolve addresses
    // for the mention emails below, and never returned or broadcast.
    select: {
      title: true,
      project: { select: { memberships: { select: { user: USER_MAILABLE_SELECT } } } },
    },
  });
  if (!retro) return;

  const members = retro.project.memberships.map((m) => m.user);
  const mentionedIds = extractMentionedUserIds(input.content, members).filter(
    (id) => id !== input.authorId,
  );
  if (mentionedIds.length === 0) return;

  const url = `${process.env.APP_URL}/retros/${input.retrospectiveId}`;
  const { subject, html } = mentionEmail({
    url,
    authorName: input.authorName,
    retroTitle: retro.title,
    content: input.content,
  });

  const mentionedEmails = members.filter((m) => mentionedIds.includes(m.id)).map((m) => m.email);
  await Promise.all(
    mentionedEmails.map((email) =>
      sendMail({ to: email, subject, html }).catch((err) =>
        console.error("Failed to send mention email:", err),
      ),
    ),
  );
}

/**
 * Loads addresses at the point of sending, by id.
 *
 * The notify helpers used to be handed the `user` objects an action had
 * already fetched — which is why those actions selected emails at all, and why
 * the emails then travelled on to the browser in the action's return value and
 * its socket broadcast. Looking them up here instead costs one indexed query on
 * a path that is about to make N HTTP calls to Microsoft Graph, and makes
 * "addresses never leave the server" true by construction rather than by care.
 */
async function loadMailableUsers(userIds: string[], excludeUserId: string) {
  const unique = [...new Set(userIds)].filter((id) => id !== excludeUserId);
  if (unique.length === 0) return [];
  return prisma.user.findMany({ where: { id: { in: unique } }, ...USER_MAILABLE_SELECT });
}

/** Fires one "assigned" email per new assignee, skipping the actor themselves. */
export async function notifyAssigned(
  assigneeIds: string[],
  actor: { id: string; name: string },
  retroTitle: string,
  description: string,
  retrospectiveId: string,
) {
  const recipients = await loadMailableUsers(assigneeIds, actor.id);
  if (recipients.length === 0) return;

  const url = `${process.env.APP_URL}/retros/${retrospectiveId}`;
  const { subject, html } = actionItemAssignedEmail({
    url,
    assignerName: actor.name,
    retroTitle,
    description,
  });
  // In parallel: these used to be awaited one at a time inside the action, so
  // assigning five people meant five serial Graph round trips with the user's
  // UI stuck in `isPending`.
  await Promise.all(
    recipients.map((r) =>
      sendMail({ to: r.email, subject, html }).catch((err) =>
        console.error("Failed to send action item assignment email:", err),
      ),
    ),
  );
}

/** Fires one "unassigned" email per removed assignee, skipping the actor themselves. */
export async function notifyUnassigned(
  removedIds: string[],
  actor: { id: string; name: string },
  retroTitle: string,
  description: string,
  retrospectiveId: string,
) {
  const recipients = await loadMailableUsers(removedIds, actor.id);
  if (recipients.length === 0) return;

  const url = `${process.env.APP_URL}/retros/${retrospectiveId}`;
  const { subject, html } = actionItemUnassignedEmail({
    url,
    actorName: actor.name,
    retroTitle,
    description,
  });
  await Promise.all(
    recipients.map((r) =>
      sendMail({ to: r.email, subject, html }).catch((err) =>
        console.error("Failed to send action item unassignment email:", err),
      ),
    ),
  );
}

/** Fires one "completed" email per other assignee. */
export async function notifyCompleted(
  assigneeIds: string[],
  actor: { id: string; name: string },
  retroTitle: string,
  description: string,
  retrospectiveId: string,
) {
  const recipients = await loadMailableUsers(assigneeIds, actor.id);
  if (recipients.length === 0) return;

  const url = `${process.env.APP_URL}/retros/${retrospectiveId}`;
  const { subject, html } = actionItemCompletedEmail({
    url,
    actorName: actor.name,
    retroTitle,
    description,
  });
  await Promise.all(
    recipients.map((r) =>
      sendMail({ to: r.email, subject, html }).catch((err) =>
        console.error("Failed to send action item completed email:", err),
      ),
    ),
  );
}
