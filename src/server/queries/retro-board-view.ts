import "server-only";
import type {
  ActionItemStatus,
  MembershipRole,
  RetroPhase,
  RetroStatus,
  RetroTemplate,
} from "@/generated/prisma/client";

/**
 * Projects a raw board row into what the browser is allowed to see.
 *
 * The shape is identical whether or not the retro is anonymous, on purpose:
 *
 *  - one type means no union and no `isAnonymous ? … : …` branching spread
 *    across five components;
 *  - the client stops comparing identities altogether (`isOwn` arrives already
 *    decided), so no future field can accidentally become a join key;
 *  - and there is exactly one code path, so redaction cannot be forgotten for
 *    the anonymous case. The previous approach nulled `card.author` but left
 *    `card.authorId` in place, alongside a full member list — which made
 *    de-anonymising every card a one-step join in dev tools.
 *
 * Counts replace raw rows for votes and reactions even on attributed boards:
 * the client only ever rendered a number and a "mine" flag, and `CardVote`
 * rows carried the voter's id.
 */

export type ReactionView = { emoji: string; count: number; mine: boolean };

export type CommentView = {
  id: string;
  content: string;
  createdAt: Date;
  isOwn: boolean;
  /** null means "render as Anonymous" — never a real name withheld client-side. */
  authorName: string | null;
};

export type GroupedCardView = {
  id: string;
  content: string;
  isOwn: boolean;
  authorName: string | null;
  /** Null while tallies are concealed, same rule as CardView.voteCount. */
  voteCount: number | null;
};

export type CardView = {
  id: string;
  content: string;
  order: number;
  groupId: string | null;
  createdAt: Date;
  isOwn: boolean;
  authorName: string | null;
  /**
   * `null` means the tally is concealed for this viewer, not that it is zero.
   *
   * A nullable number is the guardrail: `null` cannot be rendered as "0" by
   * accident, whereas a truncated array silently can. During VOTE the client is
   * simply never told the count.
   */
  voteCount: number | null;
  hasVoted: boolean;
  reactions: ReactionView[];
  comments: CommentView[];
  grouped: GroupedCardView[];
};

export type ColumnView = {
  id: string;
  title: string;
  color: string;
  order: number;
  cards: CardView[];
  /**
   * Cards from other people that safe ideation is withholding. Always 0 outside
   * COLLECT — and the cards themselves were never fetched, so this is a count
   * from a separate aggregate rather than a filtered list.
   */
  hiddenCardCount: number;
};

export type ActionItemAssigneeView = { id: string; name: string };

export type ActionItemView = {
  id: string;
  description: string;
  dueDate: Date | null;
  status: ActionItemStatus;
  createdAt: Date;
  /** Action items are deliberately never anonymous — ownership is the point. */
  assignees: ActionItemAssigneeView[];
  /** The card this came out of, when it was raised from the discussion. */
  sourceCard: { id: string; content: string } | null;
  /** True when this belongs to an earlier retro and was pulled onto this board. */
  isCarriedOver: boolean;
  /** How many boards it has appeared on — a staleness signal, not a count of work. */
  carriedCount: number;
};

export type BoardView = {
  id: string;
  title: string;
  template: RetroTemplate;
  status: RetroStatus;
  isAnonymous: boolean;
  timerEndsAt: Date | null;
  createdAt: Date;
  projectId: string;
  project: { id: string; name: string; companyId: string; company: { id: string; name: string } };
  facilitatorName: string;
  columns: ColumnView[];
  actionItems: ActionItemView[];
  /** Feeds the assignee picker and @mention matching. Names only. */
  assignableMembers: { id: string; name: string }[];
  /** Decided on the server so the client never re-derives permissions. */
  viewer: { canModerate: boolean; canDelete: boolean };

  // --- The guided flow -----------------------------------------------------
  phase: RetroPhase;
  isGuided: boolean;
  checkInEnabled: boolean;
  discussCardId: string | null;
  discussSeconds: number;
  /** Null when the retro has no budget (unlimited), or isn't guided. */
  votesRemaining: number | null;
  /** Whether safe ideation can still be switched on — false once revealed. */
  canHideCards: boolean;
  hideOthersCards: boolean;
  hideVoteCounts: boolean;
  voteBudget: number;
};

type RawAuthor = { id: string; name: string } | null;

type RawCard = {
  id: string;
  content: string;
  order: number;
  groupId: string | null;
  createdAt: Date;
  authorId: string | null;
  author: RawAuthor;
  votes: { userId: string }[];
  reactions: { userId: string; emoji: string }[];
  comments: {
    id: string;
    content: string;
    createdAt: Date;
    authorId: string;
    author: RawAuthor;
  }[];
  grouped: {
    id: string;
    content: string;
    authorId: string | null;
    author: RawAuthor;
    votes: { userId: string }[];
  }[];
};

type RawBoard = {
  id: string;
  title: string;
  template: RetroTemplate;
  status: RetroStatus;
  isAnonymous: boolean;
  timerEndsAt: Date | null;
  createdAt: Date;
  projectId: string;
  phase: RetroPhase;
  isGuided: boolean;
  checkInEnabled: boolean;
  collectRevealedAt: Date | null;
  hideOthersCards: boolean;
  hideVoteCounts: boolean;
  voteBudget: number;
  discussCardId: string | null;
  discussSeconds: number;
  project: {
    id: string;
    name: string;
    companyId: string;
    company: { id: string; name: string };
    memberships: { userId: string; role: MembershipRole; user: { id: string; name: string } }[];
  };
  facilitator: { id: string; name: string };
  columns: {
    id: string;
    title: string;
    color: string;
    order: number;
    cards: RawCard[];
  }[];
  actionItems: {
    id: string;
    retrospectiveId: string;
    description: string;
    dueDate: Date | null;
    status: ActionItemStatus;
    createdAt: Date;
    assignees: { userId: string; user: { id: string; name: string } }[];
    sourceCard: { id: string; content: string } | null;
    _count: { carryOvers: number };
  }[];
};

/**
 * Whose name may be shown for a piece of content.
 *
 * On an anonymous board you can still tell which card is yours — that is what
 * makes it usable — and nothing else.
 */
function resolveAuthorName(
  isAnonymous: boolean,
  isOwn: boolean,
  author: RawAuthor,
): string | null {
  if (isAnonymous && !isOwn) return null;
  return author?.name ?? null;
}

type ProjectionOptions = { isAnonymous: boolean; concealTallies: boolean };

function toCardView(card: RawCard, viewerId: string, options: ProjectionOptions): CardView {
  const { isAnonymous, concealTallies } = options;
  const isOwn = card.authorId === viewerId;

  const reactionCounts = new Map<string, { count: number; mine: boolean }>();
  for (const reaction of card.reactions) {
    const entry = reactionCounts.get(reaction.emoji) ?? { count: 0, mine: false };
    entry.count += 1;
    if (reaction.userId === viewerId) entry.mine = true;
    reactionCounts.set(reaction.emoji, entry);
  }

  return {
    id: card.id,
    content: card.content,
    order: card.order,
    groupId: card.groupId,
    createdAt: card.createdAt,
    isOwn,
    authorName: resolveAuthorName(isAnonymous, isOwn, card.author),
    voteCount: concealTallies ? null : card.votes.length,
    // Deliberately still told: you always know where your own votes are, or
    // you cannot take one back to spend it elsewhere.
    hasVoted: card.votes.some((v) => v.userId === viewerId),
    reactions: [...reactionCounts.entries()].map(([emoji, { count, mine }]) => ({
      emoji,
      count,
      mine,
    })),
    comments: card.comments.map((comment) => {
      const commentIsOwn = comment.authorId === viewerId;
      return {
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt,
        isOwn: commentIsOwn,
        authorName: resolveAuthorName(isAnonymous, commentIsOwn, comment.author),
      };
    }),
    grouped: card.grouped.map((child) => {
      const childIsOwn = child.authorId === viewerId;
      return {
        id: child.id,
        content: child.content,
        isOwn: childIsOwn,
        authorName: resolveAuthorName(isAnonymous, childIsOwn, child.author),
        voteCount: concealTallies ? null : child.votes.length,
      };
    }),
  };
}

export function toBoardView(
  retro: RawBoard,
  viewerId: string,
  options: {
    viewer: { canModerate: boolean; canDelete: boolean };
    concealTallies: boolean;
    /** columnId -> number of other people's cards being withheld. */
    hiddenCardCounts: Record<string, number>;
    votesRemaining: number | null;
  },
): BoardView {
  const { viewer, concealTallies, hiddenCardCounts, votesRemaining } = options;
  const projection = { isAnonymous: retro.isAnonymous, concealTallies };

  return {
    id: retro.id,
    title: retro.title,
    template: retro.template,
    status: retro.status,
    isAnonymous: retro.isAnonymous,
    timerEndsAt: retro.timerEndsAt,
    createdAt: retro.createdAt,
    projectId: retro.projectId,
    project: {
      id: retro.project.id,
      name: retro.project.name,
      companyId: retro.project.companyId,
      company: { id: retro.project.company.id, name: retro.project.company.name },
    },
    // The facilitator is named publicly on the board either way, so this is a
    // name rather than a redactable author.
    facilitatorName: retro.facilitator.name,
    columns: retro.columns.map((column) => ({
      id: column.id,
      title: column.title,
      color: column.color,
      order: column.order,
      cards: column.cards.map((card) => toCardView(card, viewerId, projection)),
      hiddenCardCount: hiddenCardCounts[column.id] ?? 0,
    })),
    actionItems: retro.actionItems.map((item) => ({
      id: item.id,
      description: item.description,
      dueDate: item.dueDate,
      status: item.status,
      createdAt: item.createdAt,
      assignees: item.assignees.map((a) => ({ id: a.user.id, name: a.user.name })),
      sourceCard: item.sourceCard,
      // Belongs to a different retro, so it got here by being carried.
      isCarriedOver: item.retrospectiveId !== retro.id,
      carriedCount: item._count.carryOvers,
    })),
    // The same names the member list would have carried — but as a flat list
    // for the assignee picker, not sitting beside card author ids where it
    // doubles as a decoding table.
    assignableMembers: retro.project.memberships.map((m) => ({
      id: m.user.id,
      name: m.user.name,
    })),
    viewer,

    phase: retro.phase,
    isGuided: retro.isGuided,
    checkInEnabled: retro.checkInEnabled,
    discussCardId: retro.discussCardId,
    discussSeconds: retro.discussSeconds,
    votesRemaining,
    // Once content has been revealed, offering to hide it again would be a
    // promise the tool cannot keep.
    canHideCards: retro.collectRevealedAt === null,
    hideOthersCards: retro.hideOthersCards,
    hideVoteCounts: retro.hideVoteCounts,
    voteBudget: retro.voteBudget,
  };
}
