import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { RetroPhase, RetroStatus } from "@/generated/prisma/client";

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "Not signed in") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * The input didn't pass validation at the action boundary. Distinct from
 * Forbidden (you may not) and NotFound (it isn't there) — this one means the
 * request itself was malformed.
 */
export class BadRequestError extends Error {
  constructor(message = "Invalid input") {
    super(message);
    this.name = "BadRequestError";
  }
}

/**
 * The thing itself doesn't exist (deleted, bad id, stale link) — distinct
 * from ForbiddenError (it exists, you just can't see it). Pages should
 * catch this and call Next's notFound(), which ForbiddenError shouldn't.
 */
export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "SUPER_ADMIN" | "USER";
};

/**
 * Loads the caller's current role and name from the database.
 *
 * Wrapped in React's `cache()` so the whole request shares one lookup: a page
 * typically calls requireUser three or four times through the various guards,
 * and this collapses those into a single indexed read on the primary key.
 */
const loadSessionUser = cache(async (userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  }),
);

/**
 * Throws if there's no signed-in user; otherwise returns them.
 *
 * The identity comes from the session cookie but the *role* comes from the
 * database, deliberately. Role and name were written into the JWT once at
 * sign-in and never refreshed, so demoting a Super Admin left them with full
 * platform access until their token expired — up to 30 days — and a rename
 * never showed. Re-reading here also handles a user whose account has since
 * been deleted.
 *
 * Doing this in the `jwt` callback instead would put a Prisma query into
 * proxy.ts's import graph, since it re-exports the whole NextAuth config; the
 * proxy only ever checks that a session exists, so it stays untouched.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();

  const user = await loadSessionUser(session.user.id);
  if (!user) throw new UnauthorizedError("Your account no longer exists");
  return user;
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") throw new ForbiddenError("Super admin only");
  return user;
}

/** Super admin, or a company ADMIN member, may manage the company (e.g. create projects in it). */
export async function requireCompanyAdmin(companyId: string): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === "SUPER_ADMIN") return user;

  const membership = await prisma.companyMembership.findUnique({
    where: { userId_companyId: { userId: user.id, companyId } },
  });
  if (!membership || membership.role !== "ADMIN") {
    throw new ForbiddenError("Company admin only");
  }
  return user;
}

/** Any member of the company (super admin bypasses). */
export async function requireCompanyMember(companyId: string): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === "SUPER_ADMIN") return user;

  const membership = await prisma.companyMembership.findUnique({
    where: { userId_companyId: { userId: user.id, companyId } },
  });
  if (!membership) throw new ForbiddenError("Not a member of this company");
  return user;
}

/**
 * The gate every AI code path starts with.
 *
 * Deliberately a `require*` in this file, alongside the membership checks,
 * rather than an `if` at each call site: sending a retrospective's contents to
 * a model provider is the same kind of decision as sending them to another
 * user, and it should be refused in the same way and in the same place.
 *
 * **Super Admin does not bypass this.** Everywhere else in this file a
 * platform admin can reach anything, because their job is to administer the
 * install. This is not an access question — it is whether the company that
 * owns the data has agreed to it leaving — and no role on our side can answer
 * that on their behalf.
 *
 * Note what it is not used for: Phase 4's insights run entirely on the
 * project's own data with no model call, so they are identical whether or not
 * this is switched on. That is by design — a company that never enables AI
 * loses no feature it can see.
 */
export async function requireCompanyAiEnabled(companyId: string): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { aiFeaturesEnabled: true },
  });
  if (!company) throw new NotFoundError("Company not found");
  if (!company.aiFeaturesEnabled) {
    throw new ForbiddenError(
      "AI features are switched off for this company. A company admin can turn them on in the company settings.",
    );
  }
}

/** True if the user is an ADMIN member of this company (Super Admin does not automatically count here — check that separately). */
export async function isCompanyAdmin(userId: string, companyId: string): Promise<boolean> {
  const membership = await prisma.companyMembership.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  return membership?.role === "ADMIN";
}

/**
 * Any member of the project may act (e.g. invite others) unless `adminOnly`
 * is set. A company admin counts as a project admin for every project in
 * their company, even ones they aren't directly a member of — they manage
 * the whole company, so browsing/acting on any project in it shouldn't 404
 * or 403 just because nobody added them to that specific project.
 */
export async function requireProjectMember(
  projectId: string,
  opts: { adminOnly?: boolean } = {},
): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === "SUPER_ADMIN") return user;

  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: user.id, projectId } },
  });
  if (membership) {
    if (opts.adminOnly && membership.role !== "ADMIN") {
      throw new ForbiddenError("Project admin only");
    }
    return user;
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { companyId: true },
  });
  if (project && (await isCompanyAdmin(user.id, project.companyId))) {
    return user;
  }

  throw new ForbiddenError("Not a member of this project");
}

/** Project admin, company admin (of the project's company), or Super Admin. */
export async function requireProjectOrCompanyAdmin(
  projectId: string,
  companyId: string,
): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === "SUPER_ADMIN") return user;

  const [projectMembership, companyMembership] = await Promise.all([
    prisma.projectMembership.findUnique({
      where: { userId_projectId: { userId: user.id, projectId } },
    }),
    prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId: user.id, companyId } },
    }),
  ]);

  if (projectMembership?.role === "ADMIN" || companyMembership?.role === "ADMIN") {
    return user;
  }
  throw new ForbiddenError("Project admin or company admin only");
}

/**
 * Everything an action needs to decide what the caller may do to a retro,
 * loaded once. Explicitly listed rather than `include`d, so no column can
 * drift into it and from there into a client payload.
 */
export type RetroContext = {
  id: string;
  projectId: string;
  companyId: string;
  facilitatorId: string;
  status: RetroStatus;
  isAnonymous: boolean;
  // The guided flow. Loaded here because the phase gate, the concealment rules
  // in getRetroBoard and the vote budget all need it on every request, and
  // re-querying for it is exactly how a check gets skipped.
  phase: RetroPhase;
  isGuided: boolean;
  hideOthersCards: boolean;
  collectRevealedAt: Date | null;
  hideVoteCounts: boolean;
  voteBudget: number;
  checkInEnabled: boolean;
  discussCardId: string | null;
  discussSeconds: number;
};

/**
 * Membership in the project that owns a given retrospective.
 *
 * Returns the retro alongside the user, rather than throwing it away: callers
 * need `facilitatorId`/`companyId`/`status` for the moderator and writability
 * checks, and every one of them used to re-query for it — or, worse, skip the
 * check because re-querying was inconvenient.
 */
export async function requireRetroAccess(
  retrospectiveId: string,
): Promise<{ user: SessionUser; retro: RetroContext }> {
  const user = await requireUser();
  const retro = await prisma.retrospective.findUnique({
    where: { id: retrospectiveId },
    select: {
      id: true,
      projectId: true,
      facilitatorId: true,
      status: true,
      isAnonymous: true,
      phase: true,
      isGuided: true,
      hideOthersCards: true,
      collectRevealedAt: true,
      hideVoteCounts: true,
      voteBudget: true,
      checkInEnabled: true,
      discussCardId: true,
      discussSeconds: true,
      project: { select: { companyId: true } },
    },
  });
  if (!retro) throw new NotFoundError("Retrospective not found");
  await requireProjectMember(retro.projectId);

  const { project, ...rest } = retro;
  return { user, retro: { ...rest, companyId: project.companyId } };
}

/** Facilitator, project/company admin, or Super Admin — for session-level controls. */
export async function requireRetroModerator(
  retrospectiveId: string,
): Promise<{ user: SessionUser; retro: RetroContext }> {
  const { user, retro } = await requireRetroAccess(retrospectiveId);
  if (!(await isRetroModerator(user, retro))) {
    throw new ForbiddenError("Only this retrospective's facilitator or a project admin can do that");
  }
  return { user, retro };
}

/**
 * A retro that isn't ACTIVE is read-only to everyone but a moderator. This
 * rule already existed for adding cards; it now covers every board mutation,
 * because "Complete retrospective" that still accepts votes and comments isn't
 * completing anything.
 */
export async function assertRetroWritable(retro: RetroContext, user: SessionUser): Promise<void> {
  if (retro.status === "ACTIVE") return;
  if (await isRetroModerator(user, retro)) return;
  throw new ForbiddenError(
    "This retrospective is no longer active — only its facilitator or an admin can change it now",
  );
}

/**
 * Super Admin, the retro's facilitator, or a project/company ADMIN.
 *
 * Lives here rather than in a `"use server"` module on purpose. As an exported
 * Server Action it was a public endpoint whose *first argument* was the
 * identity to check — so anyone could POST an arbitrary user id and learn
 * whether that person admins an arbitrary project. Taking the caller-supplied
 * `user` is fine for an internal helper; it is only dangerous when the
 * function is reachable from the network. Callers must pass a session-derived
 * user (one returned by a `require*` helper), never client input.
 */
export async function isRetroModerator(
  user: { id: string; role: "SUPER_ADMIN" | "USER" },
  retro: { facilitatorId: string; projectId: string; companyId: string },
): Promise<boolean> {
  if (user.role === "SUPER_ADMIN") return true;
  if (user.id === retro.facilitatorId) return true;
  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: user.id, projectId: retro.projectId } },
  });
  if (membership?.role === "ADMIN") return true;
  return isCompanyAdmin(user.id, retro.companyId);
}
