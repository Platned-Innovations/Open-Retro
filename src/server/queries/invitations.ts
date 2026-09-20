import "server-only";

import { prisma } from "@/lib/prisma";
import { requireProjectMember } from "@/lib/authz";
import { USER_DIRECTORY_SELECT } from "@/server/user-select";

/**
 * Company members who aren't already on this project — for the "add
 * existing member" path, which skips the email-invite round trip entirely
 * for people who can already sign in.
 */
export async function listAddableCompanyMembers(projectId: string) {
  await requireProjectMember(projectId);
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { companyId: true },
  });

  const [companyMembers, projectMembers] = await Promise.all([
    prisma.companyMembership.findMany({
      where: { companyId: project.companyId },
      // Feeds a "<name> (<email>)" picker, so the directory select is the right
      // one — but nothing beyond it.
      select: { userId: true, user: USER_DIRECTORY_SELECT },
    }),
    prisma.projectMembership.findMany({ where: { projectId }, select: { userId: true } }),
  ]);

  const alreadyOnProject = new Set(projectMembers.map((m) => m.userId));
  return companyMembers
    .filter((m) => !alreadyOnProject.has(m.userId))
    .map((m) => m.user)
    .sort((a, b) => a.name.localeCompare(b.name));
}
