import "server-only";

import { prisma } from "@/lib/prisma";
import { requireProjectMember, requireUser, NotFoundError } from "@/lib/authz";
import { USER_DIRECTORY_SELECT, USER_PUBLIC_SELECT } from "@/server/user-select";
import { UNRESOLVED_STATUSES } from "@/lib/actionItems";

/** Projects the current user belongs to (or all, for a Super Admin), grouped by company. */
export async function listMyProjects() {
  const user = await requireUser();

  if (user.role === "SUPER_ADMIN") {
    const companies = await prisma.company.findMany({
      orderBy: { name: "asc" },
      include: { projects: { orderBy: { name: "asc" }, include: { _count: { select: { retrospectives: true } } } } },
    });
    return companies;
  }

  const [projectMemberships, companyMemberships] = await Promise.all([
    prisma.projectMembership.findMany({
      where: { userId: user.id },
      include: {
        project: {
          include: { company: true, _count: { select: { retrospectives: true } } },
        },
      },
    }),
    // A company-only invite (no project yet) shouldn't leave someone with
    // nowhere to land — show the company even with zero visible projects.
    prisma.companyMembership.findMany({
      where: { userId: user.id },
      include: { company: true },
    }),
  ]);

  const byCompany = new Map<
    string,
    { id: string; name: string; projects: (typeof projectMemberships)[number]["project"][] }
  >();
  for (const m of companyMemberships) {
    byCompany.set(m.company.id, { id: m.company.id, name: m.company.name, projects: [] });
  }
  for (const m of projectMemberships) {
    const c = m.project.company;
    if (!byCompany.has(c.id)) byCompany.set(c.id, { id: c.id, name: c.name, projects: [] });
    byCompany.get(c.id)!.projects.push(m.project);
  }
  return [...byCompany.values()];
}

/**
 * A project accumulates one retrospective per sprint forever, so this list is
 * the one that grows without anybody deciding to grow it.
 */
export const RETROS_PER_PAGE = 20;

export async function getProject(projectId: string, options: { retroPage?: number } = {}) {
  await requireProjectMember(projectId);
  const retroPage = Math.max(1, Math.floor(options.retroPage ?? 1));

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      company: true,
      // The total, separate from the page: the Insights link and the delete
      // warning both ask "how many retrospectives are there", and answering
      // that from the current page would give a different number on page 2.
      _count: { select: { retrospectives: true } },
      // The member list renders and searches on email, so this one is the
      // directory select rather than the public one.
      memberships: {
        select: { id: true, role: true, userId: true, user: USER_DIRECTORY_SELECT },
        orderBy: { createdAt: "asc" },
      },
      retrospectives: {
        orderBy: { createdAt: "desc" },
        skip: (retroPage - 1) * RETROS_PER_PAGE,
        take: RETROS_PER_PAGE,
        include: {
          facilitator: USER_PUBLIC_SELECT,
          // Powers the "N pending" chip next to a retro's status badge.
          _count: {
            select: { actionItems: { where: { status: { in: [...UNRESOLVED_STATUSES] } } } },
          },
        },
      },
    },
  });
  // Super Admin bypasses the membership check above, so this is the only
  // place a since-deleted project would otherwise surface at all.
  if (!project) throw new NotFoundError("Project not found");

  return {
    ...project,
    retroTotal: project._count.retrospectives,
    retroPage,
    retroPageCount: Math.max(1, Math.ceil(project._count.retrospectives / RETROS_PER_PAGE)),
  };
}
