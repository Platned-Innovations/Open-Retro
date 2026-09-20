import "server-only";

import type { ActionItemStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { UNRESOLVED_STATUSES } from "@/lib/actionItems";

/**
 * Visibility for someone's own action items.
 *
 * Deliberately re-derived from live membership rather than trusted from the
 * assignment row. `ActionItemAssignee` survives a person being removed from a
 * project, so without this they would keep seeing — and be able to act on —
 * work belonging to a team they are no longer part of.
 *
 * The company-admin branch mirrors `requireProjectMember`'s rule exactly, so
 * the two cannot disagree about who can see a project.
 */
function visibleToUser(userId: string) {
  return {
    OR: [
      { memberships: { some: { userId } } },
      { company: { memberships: { some: { userId, role: "ADMIN" as const } } } },
    ],
  };
}

export type MyActionItem = Awaited<ReturnType<typeof listMyActionItems>>[number];

/**
 * Every action item assigned to the signed-in user, across every project.
 *
 * `requireUser` rather than any admin check: these are *my* items, so being a
 * Super Admin confers nothing here.
 */
export async function listMyActionItems(
  filter: { status?: ActionItemStatus[]; projectId?: string } = {},
) {
  const user = await requireUser();

  return prisma.actionItem.findMany({
    where: {
      assignees: { some: { userId: user.id } },
      status: { in: filter.status ?? [...UNRESOLVED_STATUSES] },
      retrospective: {
        project: {
          ...(filter.projectId ? { id: filter.projectId } : {}),
          ...visibleToUser(user.id),
        },
      },
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    select: {
      id: true,
      description: true,
      status: true,
      dueDate: true,
      createdAt: true,
      retrospective: {
        select: {
          id: true,
          title: true,
          project: {
            select: { id: true, name: true, company: { select: { id: true, name: true } } },
          },
        },
      },
      // How many retros this has now dragged through — the staleness signal a
      // boolean could never carry.
      _count: { select: { carryOvers: true } },
    },
  });
}

/** Just the number, for the nav badge. */
export async function countMyOpenActionItems(): Promise<number> {
  const user = await requireUser();
  return prisma.actionItem.count({
    where: {
      assignees: { some: { userId: user.id } },
      status: { in: [...UNRESOLVED_STATUSES] },
      retrospective: { project: visibleToUser(user.id) },
    },
  });
}

/** The projects the user has work in, for the filter control. */
export async function listMyActionProjects() {
  const user = await requireUser();
  const rows = await prisma.actionItem.findMany({
    where: {
      assignees: { some: { userId: user.id } },
      retrospective: { project: visibleToUser(user.id) },
    },
    select: { retrospective: { select: { project: { select: { id: true, name: true } } } } },
    distinct: ["retrospectiveId"],
  });

  const byId = new Map(rows.map((r) => [r.retrospective.project.id, r.retrospective.project]));
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}
