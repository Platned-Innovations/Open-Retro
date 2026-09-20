"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Lock, Plus } from "lucide-react";
import { Button, Textarea } from "@platned/ui";
import { RetroCardItem } from "@/components/retro/retro-card-item";
import { HiddenCardsNotice } from "@/components/retro/hidden-cards-notice";
import { createCard } from "@/server/actions/retros";
import type { RetroColumnWithCards, RetroCardWithRelations } from "@/server/queries/retros";
import { useAction } from "@/lib/useAction";
import { cn } from "@/lib/utils";

type Props = {
  retrospectiveId: string;
  column: RetroColumnWithCards;
  topLevelCards: RetroCardWithRelations[];
  canModerate: boolean;
  canAddCards: boolean;
  canVote: boolean;
  canComment: boolean;
  canReact: boolean;
  canMoveCards: boolean;
  /** Every column on the board, for the card menu's non-drag "Move to…" items. */
  columnTargets: { id: string; title: string; cardCount: number }[];
  /** Highlighted while the group is talking about it. */
  discussCardId: string | null;
  /** Why cards can't be added right now, or null when they can. */
  closedReason: string | null;
};

export function RetroColumn({
  retrospectiveId,
  column,
  topLevelCards,
  canModerate,
  canAddCards,
  canVote,
  canComment,
  canReact,
  canMoveCards,
  columnTargets,
  discussCardId,
  closedReason,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [value, setValue] = useState("");
  const { run, isPending } = useAction();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    run(() => createCard({ retrospectiveId, columnId: column.id, content: value.trim() }), {
      onSuccess: () => setValue(""),
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center gap-2 px-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column.color }} />
        {/* h2, not h3: the retro title is the page's h1 and there is nothing
            between, so h3 skipped a level and broke heading navigation. */}
        <h2 className="text-body-sm font-semibold text-default">{column.title}</h2>
        <span className="text-body-tiny text-default-secondary">{topLevelCards.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-3 rounded-xl border border-dashed border-default bg-default-secondary p-3",
          isOver && "border-brand bg-brand-tertiary",
        )}
      >
        <SortableContext
          items={topLevelCards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {topLevelCards.map((card) => (
            <RetroCardItem
              key={card.id}
              retrospectiveId={retrospectiveId}
              card={card}
              canModerate={canModerate}
              canVote={canVote}
              canComment={canComment}
              canReact={canReact}
              isUnderDiscussion={card.id === discussCardId}
              siblingCards={topLevelCards}
              canMoveCards={canMoveCards}
              moveTargets={columnTargets.filter((target) => target.id !== column.id)}
            />
          ))}
        </SortableContext>

        <HiddenCardsNotice count={column.hiddenCardCount} />
      </div>

      {canAddCards ? (
        <form onSubmit={handleAdd} className="flex flex-col gap-2">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Add a card…"
            aria-label={`Add a card to ${column.title}`}
            // The Enter/Shift+Enter split is invisible otherwise: a screen
            // reader user has no way to discover that Enter submits here when
            // it inserts a newline in every other textarea they meet.
            aria-describedby={`${column.id}-card-hint`}
            className="min-h-16 text-body-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAdd(e);
              }
            }}
          />
          <p id={`${column.id}-card-hint`} className="sr-only">
            Press Enter to add the card, or Shift and Enter together for a new line.
          </p>
          <Button type="submit" variant="neutral" size="sm" disabled={isPending} leadingIcon={<Plus className="h-3.5 w-3.5" />}>
            Add card
          </Button>
        </form>
      ) : (
        closedReason && (
          <p className="flex items-center gap-1.5 px-1 text-body-tiny text-default-secondary">
            <Lock className="h-3 w-3" />
            {closedReason}
          </p>
        )
      )}
    </div>
  );
}
