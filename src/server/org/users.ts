import "server-only";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, ForbiddenError } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import type { GlobalRole } from "@/generated/prisma/client";

/** Super Admin only: rename any user from the admin console, regardless of shared company/project. */
export async function updateUserName(userId: string, name: string) {
  await requireSuperAdmin();
  await prisma.user.update({ where: { id: userId }, data: { name: name.trim() } });
  revalidatePath("/admin");
}

/**
 * Super Admin only: promote/demote a user's platform-wide role. Blocks
 * demoting the last remaining Super Admin — that's how the platform ends up
 * with no one left who can grant the role back.
 */
export async function updateUserGlobalRole(userId: string, role: GlobalRole) {
  await requireSuperAdmin();
  if (role !== "SUPER_ADMIN") {
    const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (target.role === "SUPER_ADMIN") {
      const superAdminCount = await prisma.user.count({ where: { role: "SUPER_ADMIN" } });
      if (superAdminCount <= 1) {
        throw new ForbiddenError("The platform needs at least one Super Admin — promote someone else first");
      }
    }
  }
  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin");
}

/**
 * Super Admin only: add a user straight onto a project from the admin
 * console — and onto its company too, if they aren't already a member of
 * that, since a project membership without one doesn't make sense.
 */
export async function assignUserToProject(userId: string, projectId: string) {
  await requireSuperAdmin();
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });

  await prisma.companyMembership.upsert({
    where: { userId_companyId: { userId, companyId: project.companyId } },
    update: {},
    create: { userId, companyId: project.companyId, role: "MEMBER" },
  });
  await prisma.projectMembership.upsert({
    where: { userId_projectId: { userId, projectId } },
    update: {},
    create: { userId, projectId, role: "MEMBER" },
  });
  revalidatePath("/admin");
}
