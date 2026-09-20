import { vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { SessionUser } from "@/lib/authz";
import { COLUMN_TEMPLATES } from "@/lib/retroTemplates";
import type { RetroPhase } from "@/generated/prisma/client";

/**
 * Two companies, so every "can this person reach that thing" test has a real
 * tenant boundary to cross rather than a hypothetical one.
 *
 *   CompanyA ── ProjectA1 ── retroA, anonRetroA
 *            └─ ProjectA2
 *   CompanyB ── ProjectB1 ── retroB
 */
export type Fixture = Awaited<ReturnType<typeof seedFixture>>;

type SeedUser = { id: string; email: string; name: string; role: "SUPER_ADMIN" | "USER" };

async function createUser(name: string, role: "SUPER_ADMIN" | "USER" = "USER"): Promise<SeedUser> {
  return prisma.user.create({
    data: {
      email: `${name}@example.test`,
      name,
      role,
      // A real bcrypt-shaped value on the super admin, so the payload-leak test
      // has something to actually find if a query over-selects.
      passwordHash: role === "SUPER_ADMIN" ? "$2b$12$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMN" : null,
    },
    select: { id: true, email: true, name: true, role: true },
  });
}

/**
 * The fixture's retros are **ungated** (`isGuided: false`), matching a board
 * created before the phase engine existed.
 *
 * Most of the suite is about authorization, validation and redaction, none of
 * which are phase concerns — running those through a guided flow would mean
 * every test first had to advance the board to the right step, which tests the
 * fixture rather than the thing under test. Phase behaviour has its own file,
 * where retros are created guided on purpose.
 */
type GuidedOptions = {
  phase: RetroPhase;
  voteBudget?: number;
  hideOthersCards?: boolean;
  hideVoteCounts?: boolean;
  /** Defaults on, matching a retro created today. */
  checkInEnabled?: boolean;
};

async function createRetro(input: {
  projectId: string;
  title: string;
  facilitatorId: string;
  isAnonymous?: boolean;
  guided?: GuidedOptions;
}) {
  return prisma.retrospective.create({
    data: {
      projectId: input.projectId,
      title: input.title,
      template: "START_STOP_CONTINUE",
      status: "ACTIVE",
      isAnonymous: input.isAnonymous ?? false,
      facilitatorId: input.facilitatorId,
      createdById: input.facilitatorId,
      startedAt: new Date(),
      isGuided: Boolean(input.guided),
      phase: input.guided?.phase ?? "COLLECT",
      voteBudget: input.guided?.voteBudget ?? 0,
      hideOthersCards: input.guided?.hideOthersCards ?? false,
      hideVoteCounts: input.guided?.hideVoteCounts ?? false,
      checkInEnabled: input.guided?.checkInEnabled ?? true,
      columns: {
        create: COLUMN_TEMPLATES.START_STOP_CONTINUE.map((c, i) => ({ ...c, order: i })),
      },
    },
    include: { columns: { orderBy: { order: "asc" } } },
  });
}

/** A guided retro, for the tests that are actually about the flow. */
export async function seedGuidedRetro(f: Fixture, guided: GuidedOptions) {
  return createRetro({
    projectId: f.projectA1.id,
    title: `Guided (${guided.phase})`,
    facilitatorId: f.users.projA1Admin.id,
    guided,
  });
}

export async function seedFixture() {
  const superAdmin = await createUser("superAdmin", "SUPER_ADMIN");
  const [coAAdmin, projA1Admin, projA1Member, projA1Other, projA2Member, outsiderB, stranger] =
    await Promise.all([
      createUser("coAAdmin"),
      createUser("projA1Admin"),
      createUser("projA1Member"),
      createUser("projA1Other"),
      createUser("projA2Member"),
      createUser("outsiderB"),
      createUser("stranger"),
    ]);

  const companyA = await prisma.company.create({ data: { name: "Company A", createdById: superAdmin.id } });
  const companyB = await prisma.company.create({ data: { name: "Company B", createdById: superAdmin.id } });

  await prisma.companyMembership.createMany({
    data: [
      // Deliberately a company admin who belongs to NO project — the documented
      // company-admin-reaches-every-project rule only means something with them.
      { userId: coAAdmin.id, companyId: companyA.id, role: "ADMIN" },
      { userId: projA1Admin.id, companyId: companyA.id, role: "MEMBER" },
      { userId: projA1Member.id, companyId: companyA.id, role: "MEMBER" },
      { userId: projA1Other.id, companyId: companyA.id, role: "MEMBER" },
      { userId: projA2Member.id, companyId: companyA.id, role: "MEMBER" },
      { userId: outsiderB.id, companyId: companyB.id, role: "MEMBER" },
    ],
  });

  const projectA1 = await prisma.project.create({
    data: { companyId: companyA.id, name: "Project A1", createdById: projA1Admin.id },
  });
  const projectA2 = await prisma.project.create({
    data: { companyId: companyA.id, name: "Project A2", createdById: superAdmin.id },
  });
  const projectB1 = await prisma.project.create({
    data: { companyId: companyB.id, name: "Project B1", createdById: outsiderB.id },
  });

  await prisma.projectMembership.createMany({
    data: [
      { userId: projA1Admin.id, projectId: projectA1.id, role: "ADMIN" },
      { userId: projA1Member.id, projectId: projectA1.id, role: "MEMBER" },
      { userId: projA1Other.id, projectId: projectA1.id, role: "MEMBER" },
      { userId: projA2Member.id, projectId: projectA2.id, role: "ADMIN" },
      { userId: outsiderB.id, projectId: projectB1.id, role: "ADMIN" },
    ],
  });

  const retroA = await createRetro({
    projectId: projectA1.id,
    title: "Retro A",
    facilitatorId: projA1Admin.id,
  });
  const anonRetroA = await createRetro({
    projectId: projectA1.id,
    title: "Anonymous Retro A",
    facilitatorId: projA1Admin.id,
    isAnonymous: true,
  });
  const retroB = await createRetro({
    projectId: projectB1.id,
    title: "Retro B",
    facilitatorId: outsiderB.id,
  });

  return {
    users: { superAdmin, coAAdmin, projA1Admin, projA1Member, projA1Other, projA2Member, outsiderB, stranger },
    companyA,
    companyB,
    projectA1,
    projectA2,
    projectB1,
    retroA,
    anonRetroA,
    retroB,
  };
}

type SeededRetro = Awaited<ReturnType<typeof createRetro>>;

/**
 * A card on a retro's board.
 *
 * `retrospectiveId` is denormalised onto RetroCard and enforced by a composite
 * foreign key, so every create has to name it — this keeps that out of the
 * tests themselves, and makes it impossible for one to seed an inconsistent row
 * by accident.
 */
export async function seedCard(
  retro: SeededRetro,
  input: { authorId: string | null; content: string; columnIndex?: number; order?: number; groupId?: string },
) {
  const column = retro.columns[input.columnIndex ?? 0];
  return prisma.retroCard.create({
    data: {
      columnId: column.id,
      retrospectiveId: retro.id,
      authorId: input.authorId,
      content: input.content,
      order: input.order ?? 0,
      groupId: input.groupId,
    },
  });
}

export async function seedVote(retro: SeededRetro, cardId: string, userId: string) {
  return prisma.cardVote.create({ data: { cardId, retrospectiveId: retro.id, userId } });
}

/** Points the mocked `auth()` at this user for everything that follows. */
export function asUser(user: SeedUser): SessionUser {
  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
  vi.mocked(auth).mockResolvedValue({ user: sessionUser } as never);
  return sessionUser;
}

/** No signed-in user at all. */
export function asSignedOut() {
  vi.mocked(auth).mockResolvedValue(null as never);
}
