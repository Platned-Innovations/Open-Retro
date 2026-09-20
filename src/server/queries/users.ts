import "server-only";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/authz";
import { USER_ADMIN_SELECT } from "@/server/user-select";

export type UserFilter = {
  companyId?: string;
  projectId?: string;
  page?: number;
};

export const USERS_PER_PAGE = 50;

/**
 * Super Admin: users on the platform, optionally filtered by company or project.
 *
 * Paged, because this is the one query whose result set is the size of the
 * whole install — every row carries its full company and project membership
 * lists, so an unbounded read grows quadratically with adoption.
 */
export async function listAllUsers(filter: UserFilter = {}) {
  await requireSuperAdmin();
  const page = Math.max(1, Math.floor(filter.page ?? 1));

  const where = {
    ...(filter.projectId
      ? { projectMemberships: { some: { projectId: filter.projectId } } }
      : {}),
    ...(filter.companyId
      ? { companyMemberships: { some: { companyId: filter.companyId } } }
      : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * USERS_PER_PAGE,
      take: USERS_PER_PAGE,
      select: {
        ...USER_ADMIN_SELECT.select,
        companyMemberships: {
          select: { id: true, role: true, company: { select: { id: true, name: true } } },
        },
        projectMemberships: {
          select: {
            id: true,
            role: true,
            project: { select: { id: true, name: true, company: { select: { id: true, name: true } } } },
          },
        },
      },
    }),
  ]);

  return {
    users,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / USERS_PER_PAGE)),
  };
}

export async function listCompaniesAndProjectsForFilters() {
  await requireSuperAdmin();
  return prisma.company.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, projects: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
  });
}
