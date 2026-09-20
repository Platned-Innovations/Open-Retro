"use client";

import { useOptimistic, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Heart, Layers, MoreVertical, Check, X } from "lucide-react";
import { Button, IconButton, Textarea, Avatar, StatusBadge, DropdownMenu, type DropdownMenuItem } from "@platned/ui";
import { CardCommentsPopover } from "@/components/retro/card-comments-popover";
import { MergeCardDialog } from "@/components/retro/merge-card-dialog";
import {
  deleteCard,
  moveCard,
  toggleReaction,
  toggleVote,
  ungroupCard,
  updateCard,
} from "@/server/actions/retros";
import type { RetroCardWithRelations } from "@/server/queries/retros";
import { REACTIONS } from "@/lib/retroReactions";
import { useAction } from "@/lib/useAction";
import { cn } from "@/lib/utils";


// No `currentUserId` or `isAnonymous`: the server already decided `card.isOwn`
// and `card.authorName`, so this component has no identity comparison to make.
type Props = {
  retrospectiveId: string;
  card: RetroCardWithRelations;
  canModerate: boolean;
  canVote: boolean;
  canComment: boolean;
  canReact: boolean;
  /** The card the group is currently talking about, during DISCUSS. */
  isUnderDiscussion: boolean;
  /**
   * The column's whole top-level list, shared by reference across every card
   * in it. Filtering it per card was the O(n²) allocation that made a busy
   * column crawl; the merge dialog filters it once, when it opens.
   */
  siblingCards: RetroCardWithRelations[];
  canMoveCards: boolean;
  /** The other columns, so a card can be moved without dragging it. */
  moveTargets: { id: string; title: string; cardCount: number }[];
};

export function RetroCardItem({
  retrospectiveId,
  card,
  canModerate,
  canVote,
  canComment,
  canReact,
  isUnderDiscussion,
  siblingCards,
  canMoveCards,
  moveTargets,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [draft, setDraft] = useState(card.content);
  // No `isPending` gate on the vote/react buttons any more: the optimistic
  // state already reflects the click, and disabling them mid-flight is what
  // made a fast double-click race the server in the first place.
  const { run } = useAction();

  /**
   * Voting and reacting are the two things people do fastest and most often,
   * and both previously waited on a round trip plus a full board re-read before
   * anything moved. Showing the result immediately and letting the server
   * confirm is the difference between a board that feels live and one that
   * feels laggy. React drops these as soon as fresh server data arrives, so a
   * refused action corrects itself without any rollback code.
   */
  const [optimistic, applyOptimistic] = useOptimistic(
    { voteCount: card.voteCount, hasVoted: card.hasVoted, reactions: card.reactions },
    (state, change: { type: "vote" } | { type: "reaction"; emoji: string }) => {
      if (change.type === "vote") {
        return {
          ...state,
          hasVoted: !state.hasVoted,
          // null means the tally is concealed during VOTE — there is no number
          // on screen to move, and inventing one would reveal what the phase is
          // deliberately withholding.
          voteCount:
            state.voteCount === null ? null : state.voteCount + (state.hasVoted ? -1 : 1),
        };
      }

      const existing = state.reactions.find((r) => r.emoji === change.emoji);
      const mine = existing?.mine ?? false;
      const nextCount = (existing?.count ?? 0) + (mine ? -1 : 1);
      const others = state.reactions.filter((r) => r.emoji !== change.emoji);

      return {
        ...state,
        reactions:
          nextCount > 0
            ? [...others, { emoji: change.emoji, count: nextCount, mine: !mine }]
            : others,
      };
    },
  );

  // `isOwn` and `authorName` arrive already decided by the server. Anonymous
  // means anonymous to everyone, including moderators — a null name here is a
  // name the browser was never sent, not one it is choosing to hide.
  const canEdit = card.isOwn || canModerate;
  const authorName = card.authorName ?? "Anonymous";
  const hasVoted = optimistic.hasVoted;

  function saveEdit() {
    if (!draft.trim() || draft === card.content) {
      setIsEditing(false);
      return;
    }
    run(() => updateCard(retrospectiveId, card.id, draft.trim()));
    setIsEditing(false);
  }

  const menuItems: DropdownMenuItem[] = [{ label: "Edit", onSelect: () => setIsEditing(true) }];

  /**
   * The non-drag way to move a card.
   *
   * Dragging is pointer-first by nature: on a phone there is no drag at all,
   * and with a keyboard it works but is fiddly. This is the path that makes
   * the board rearrangeable on a device someone is actually holding — and it
   * lands the card at the end of the target column, which is where "move it
   * over there" means when you aren't pointing at a position.
   */
  if (canMoveCards) {
    for (const target of moveTargets) {
      menuItems.push({
        label: `Move to: ${target.title}`,
        separatorBefore: target.id === moveTargets[0]?.id,
        onSelect: () =>
          run(() =>
            moveCard({
              retrospectiveId,
              cardId: card.id,
              toColumnId: target.id,
              toIndex: target.cardCount,
            }),
          ),
      });
    }
  }

  // One item that opens a picker, rather than one item per other card.
  if (siblingCards.length > 1) {
    menuItems.push({ label: "Merge into…", onSelect: () => setIsMerging(true) });
  }

  if (card.groupId) {
    menuItems.push({ label: "Ungroup", onSelect: () => run(() => ungroupCard(retrospectiveId, card.id)) });
  }
  menuItems.push({
    label: "Delete",
    tone: "danger",
    separatorBefore: true,
    onSelect: () => run(() => deleteCard(retrospectiveId, card.id)),
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group flex flex-col gap-2 rounded-lg border border-default bg-default p-3 shadow-sm",
        isDragging && "opacity-50",
        // Everyone's board marks the same card, so "the one we're on" is never
        // ambiguous mid-discussion.
        isUnderDiscussion && "border-brand ring-2 ring-brand/30",
      )}
    >
      <div className="flex items-start gap-2">
        {/* `touch-none` is not cosmetic: without it the browser claims the
            gesture for scrolling and a touch drag never starts at all. The
            label matters for the same reason — this was an unnamed icon
            button, so a screen reader announced nothing. */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Move card: ${card.content.slice(0, 40)}`}
          className="mt-0.5 shrink-0 cursor-grab touch-none text-default-secondary hover:text-default active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {isEditing ? (
          <div className="flex flex-1 flex-col gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-16 text-body-sm"
              autoFocus
            />
            <div className="flex justify-end gap-1">
              <IconButton variant="subtle" aria-label="Cancel edit" onClick={() => setIsEditing(false)}>
                <X className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton variant="primary" aria-label="Save edit" onClick={saveEdit}>
                <Check className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          </div>
        ) : (
          <p className="flex-1 text-body-sm whitespace-pre-wrap text-default">{card.content}</p>
        )}

        {canEdit && !isEditing && (
          <div className="reveal-on-hover shrink-0">
            <DropdownMenu
              items={menuItems}
              label={`Card actions for "${card.content.slice(0, 30)}"`}
              align="right"
              trigger={<MoreVertical className="size-3.5" />}
            />
          </div>
        )}
      </div>

      {card.grouped.length > 0 && (
        <StatusBadge
          tone="neutral"
          icon={<Layers className="h-3 w-3" />}
          label={`+${card.grouped.length} merged`}
          size="sm"
          className="w-fit"
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <Avatar type="initial" initial={authorName.slice(0, 1).toUpperCase()} size="sm" />
          <span className="truncate text-body-tiny text-default-secondary">{authorName}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {REACTIONS.map((emoji) => {
            const reaction = optimistic.reactions.find((r) => r.emoji === emoji);
            const count = reaction?.count ?? 0;
            const mine = reaction?.mine ?? false;
            return (
              <button
                key={emoji}
                disabled={!canReact}
                aria-pressed={mine}
                aria-label={`${mine ? "Remove" : "Add"} ${emoji} reaction${count > 0 ? ` (${count})` : ""}`}
                onClick={() =>
                  run(() => toggleReaction(retrospectiveId, card.id, emoji), {
                    optimistic: () => applyOptimistic({ type: "reaction", emoji }),
                  })
                }
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-body-tiny transition-colors",
                  mine ? "bg-brand-tertiary" : "bg-default-secondary hover:bg-default-secondary-hover",
                )}
              >
                {emoji} {count > 0 && count}
              </button>
            );
          })}

          <CardCommentsPopover
            retrospectiveId={retrospectiveId}
            card={card}
            canComment={canComment}
          />

          <Button
            variant="subtle"
            size="sm"
            disabled={!canVote}
            aria-pressed={hasVoted}
            aria-label={
              optimistic.voteCount === null
                ? `${hasVoted ? "Remove your vote" : "Vote"} (tally hidden until voting ends)`
                : `${hasVoted ? "Remove your vote" : "Vote"} (${optimistic.voteCount})`
            }
            className={cn(hasVoted && "text-danger")}
            onClick={() =>
              run(() => toggleVote(retrospectiveId, card.id), {
                optimistic: () => applyOptimistic({ type: "vote" }),
              })
            }
            leadingIcon={<Heart className={cn("h-3.5 w-3.5", hasVoted && "fill-current")} />}
          >
            {optimistic.voteCount}
          </Button>
        </div>
      </div>

      {isMerging && (
        <MergeCardDialog
          retrospectiveId={retrospectiveId}
          card={card}
          siblingCards={siblingCards}
          onClose={() => setIsMerging(false)}
        />
      )}
    </div>
  );
}
