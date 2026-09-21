"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Lock, Plus } from "lucide-react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import { alpha } from "@mui/material/styles";
import { RetroCardItem } from "@/components/retro/retro-card-item";
import { HiddenCardsNotice } from "@/components/retro/hidden-cards-notice";
import { createCard } from "@/server/actions/retros";
import type { RetroColumnWithCards, RetroCardWithRelations } from "@/server/queries/retros";
import { useAction } from "@/lib/useAction";

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
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", px: 0.5 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: column.color, flexShrink: 0 }} />
        {/* h2, not h3: the retro title is the page's h1 and there is nothing
            between, so h3 skipped a level and broke heading navigation. */}
        <Typography component="h2" variant="body2" sx={{ fontWeight: 600 }}>
          {column.title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {topLevelCards.length}
        </Typography>
      </Stack>

      <Box
        ref={setNodeRef}
        sx={{
          display: "flex",
          minHeight: 96,
          flex: 1,
          flexDirection: "column",
          gap: 1.5,
          borderRadius: 3,
          border: 1,
          borderStyle: "dashed",
          borderColor: isOver ? column.color : alpha(column.color, 0.35),
          bgcolor: isOver ? alpha(column.color, 0.12) : alpha(column.color, 0.05),
          p: 1.5,
        }}
      >
        <SortableContext items={topLevelCards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
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
      </Box>

      {canAddCards ? (
        <Stack component="form" onSubmit={handleAdd} spacing={1}>
          <TextField
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Add a card…"
            aria-label={`Add a card to ${column.title}`}
            // The Enter/Shift+Enter split is invisible otherwise: a screen
            // reader user has no way to discover that Enter submits here when
            // it inserts a newline in every other textarea they meet.
            aria-describedby={`${column.id}-card-hint`}
            multiline
            minRows={2}
            size="small"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAdd(e);
              }
            }}
          />
          <Typography id={`${column.id}-card-hint`} sx={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            Press Enter to add the card, or Shift and Enter together for a new line.
          </Typography>
          <Button type="submit" variant="outlined" size="small" disabled={isPending} startIcon={<Plus className="h-3.5 w-3.5" />}>
            Add card
          </Button>
        </Stack>
      ) : (
        closedReason && (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", px: 0.5 }}>
            <Lock className="h-3 w-3" />
            <Typography variant="caption" color="text.secondary">
              {closedReason}
            </Typography>
          </Stack>
        )
      )}
    </Stack>
  );
}
