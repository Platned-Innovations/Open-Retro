import "server-only";

import { prisma } from "@/lib/prisma";
import {
  isCompanyAdmin,
  isRetroModerator,
  requireProjectMember,
  requireRetroAccess,
} from "@/lib/authz";
import { USER_PUBLIC_SELECT } from "@/server/user-select";
import { toBoardView, type BoardView } from "@/server/queries/retro-board-view";

/**
 * Everything the board page renders, already redacted for this viewer.
 *
 * Nothing here is returned raw: the result goes through `toBoardView`, which is
 * the single place that decides what may cross to the browser. See the note at
 * the top of ./retro-board-view.ts for why that projection is unconditional.
 */
export async function getRetroBoard(retrospectiveId: string): Promise<BoardView> {
  const { user, retro: ctx } = await requireRetroAccess(retrospectiveId);

  /**
   * Safe ideation. During COLLECT nobody sees anyone else's card — and that
   * includes the facilitator, deliberately. Anchoring doesn't spare the person
   * running the session, and a facilitator who can read the board while
   * everyone else can't is a trust problem rather than a feature.
   *
   * Once `collectRevealedAt` is set the board stays readable forever. Words
   * that have been read cannot be un-read, so re-entering COLLECT must not
   * pretend otherwise.
   */
  const concealCards =
    ctx.isGuided &&
    ctx.phase === "COLLECT" &&
    ctx.hideOthersCards &&
    ctx.collectRevealedAt === null;

  /**
   * Tallies stay hidden while voting is open, so early votes don't snowball
   * into a bandwagon. Revealed from DISCUSS onwards, when the ranking is the
   * whole point.
   */
  const concealTallies = ctx.isGuided && ctx.phase === "VOTE" && ctx.hideVoteCounts;

  const retro = await prisma.retrospective.findUniqueOrThrow({
    where: { id: retrospectiveId },
    select: {
      id: true,
      title: true,
      template: true,
      status: true,
      isAnonymous: true,
      timerEndsAt: true,
      createdAt: true,
      projectId: true,
      phase: true,
      isGuided: true,
      checkInEnabled: true,
      collectRevealedAt: true,
      hideOthersCards: true,
      hideVoteCounts: true,
      voteBudget: true,
      discussCardId: true,
      discussSeconds: true,
      project: {
        select: {
          id: true,
          name: true,
          companyId: true,
          company: { select: { id: true, name: true } },
          memberships: { select: { userId: true, role: true, user: USER_PUBLIC_SELECT } },
        },
      },
      facilitator: USER_PUBLIC_SELECT,
      columns: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          color: true,
          order: true,
          cards: {
            // Concealment by *query*, not by render: other people's rows are
            // never fetched at all, so there is nothing in the payload for a
            // determined viewer to find.
            where: concealCards ? { authorId: user.id } : {},
            // createdAt as a tiebreak: `order` collisions are rare now that
            // creation is transactional, but a stable secondary sort is what
            // makes a collision cosmetic rather than a board that reshuffles
            // itself between refreshes.
            orderBy: [{ order: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              content: true,
              order: true,
              groupId: true,
              createdAt: true,
              authorId: true,
              author: USER_PUBLIC_SELECT,
              votes: { select: { userId: true } },
              reactions: { select: { userId: true, emoji: true } },
              comments: {
                orderBy: { createdAt: "asc" },
                select: {
                  id: true,
                  content: true,
                  createdAt: true,
                  authorId: true,
                  author: USER_PUBLIC_SELECT,
                },
              },
              grouped: {
                select: {
                  id: true,
                  content: true,
                  authorId: true,
                  author: USER_PUBLIC_SELECT,
                  votes: { select: { userId: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  /**
   * A board shows its own action items *and* any carried onto it from an
   * earlier retro — which is why this can't be a nested include: the carried
   * ones belong to a different retrospective entirely.
   */
  const actionItems = await prisma.actionItem.findMany({
    where: {
      OR: [{ retrospectiveId }, { carryOvers: { some: { retrospectiveId } } }],
    },
    orderBy: [{ status: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    select: {
      id: true,
      retrospectiveId: true,
      description: true,
      dueDate: true,
      status: true,
      createdAt: true,
      assignees: { select: { userId: true, user: USER_PUBLIC_SELECT } },
      sourceCard: { select: { id: true, content: true } },
      // How many boards this has now appeared on.
      _count: { select: { carryOvers: true } },
    },
  });

  // Decided here rather than in the page, so the board payload carries the
  // answer instead of the raw membership rows a client would need to work it
  // out — and so the three pages that each re-derived this can stop.
  const canModerate = await isRetroModerator(user, ctx);
  const canDelete =
    user.role === "SUPER_ADMIN" ||
    retro.project.memberships.find((m) => m.userId === user.id)?.role === "ADMIN" ||
    (await isCompanyAdmin(user.id, retro.project.companyId));

  // How many cards each column is holding back, so a column can say "7 cards
  // from others, hidden until collection ends" rather than looking empty.
  const hiddenCardCounts = concealCards
    ? await prisma.retroCard
        .groupBy({
          by: ["columnId"],
          where: { retrospectiveId, groupId: null, authorId: { not: user.id } },
          _count: { _all: true },
        })
        .then((rows) => Object.fromEntries(rows.map((r) => [r.columnId, r._count._all])))
    : {};

  const votesRemaining =
    ctx.isGuided && ctx.voteBudget > 0
      ? Math.max(
          0,
          ctx.voteBudget -
            (await prisma.cardVote.count({ where: { retrospectiveId, userId: user.id } })),
        )
      : null;

  // Attendance. Awaited rather than fired and forgotten: a write that outlives
  // the request it belongs to races anything that touches the same rows — it
  // deadlocked against a concurrent delete the first time it was tried. One
  // indexed insert with skipDuplicates is cheap enough that "just wait for it"
  // is the right answer. Failure is logged and swallowed; a missing attendance
  // row must never stop someone opening the board.
  await prisma.retroParticipant
    .createMany({ data: [{ retrospectiveId, userId: user.id }], skipDuplicates: true })
    .catch((error) => console.error("Failed to record retro attendance:", error));

  return toBoardView({ ...retro, actionItems }, user.id, {
    viewer: { canModerate, canDelete },
    concealTallies,
    hiddenCardCounts,
    votesRemaining,
  });
}

/** Other retrospectives in the same project, for the summary page's "Related content". */
export async function getRelatedRetros(projectId: string, excludeRetroId: string) {
  await requireProjectMember(projectId);
  return prisma.retrospective.findMany({
    where: { projectId, id: { not: excludeRetroId } },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: {
      id: true,
      title: true,
      createdAt: true,
      facilitator: USER_PUBLIC_SELECT,
    },
  });
}

export type CarryOverCandidate = Awaited<
  ReturnType<typeof import("@/server/retro/carryOver").listCarryOverCandidates>
>[number];

export type RetroBoard = BoardView;
export type RetroColumnWithCards = BoardView["columns"][number];
export type RetroCardWithRelations = RetroColumnWithCards["cards"][number];
export type ActionItemWithRelations = BoardView["actionItems"][number];
export type ProjectMemberOption = BoardView["assignableMembers"][number];
