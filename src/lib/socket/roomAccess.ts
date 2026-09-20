import { prisma } from "@/lib/prisma";

/**
 * May this user join the live room for this retrospective?
 *
 * `server.ts` verifies the Auth.js cookie on the handshake, so sockets are
 * authenticated — but until this existed they were not *authorized*: any signed
 * in user could join `retro:<id>` for a board in another company and receive
 * its live event stream, its `presence:update` attendee roster, and its
 * cursors. `cursor:move` was worse still, since emitting into a room never
 * required joining it at all.
 *
 * Deliberately standalone rather than reusing `@/lib/authz`: that module is
 * marked `server-only` and pulls in NextAuth and `next/headers`, none of which
 * belong in the custom server's import graph. The rule below is a copy of
 * `requireProjectMember`'s — project member, or company admin of the owning
 * company, or Super Admin — and the two are pinned together by a test that runs
 * the same user matrix through both.
 */
export async function canJoinRetroRoom(userId: string, retrospectiveId: string): Promise<boolean> {
  const retro = await prisma.retrospective.findUnique({
    where: { id: retrospectiveId },
    select: { projectId: true, project: { select: { companyId: true } } },
  });
  if (!retro) return false;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return false;
  if (user.role === "SUPER_ADMIN") return true;

  const [projectMembership, companyMembership] = await Promise.all([
    prisma.projectMembership.findUnique({
      where: { userId_projectId: { userId, projectId: retro.projectId } },
    }),
    prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId, companyId: retro.project.companyId } },
    }),
  ]);

  if (projectMembership) return true;
  return companyMembership?.role === "ADMIN";
}
