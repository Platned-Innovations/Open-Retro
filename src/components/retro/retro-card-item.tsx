"use client";

import { useOptimistic, useState, type MouseEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Heart, Layers, MoreVertical, Check, X } from "lucide-react";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import { CardCommentsPopover } from "@/components/retro/card-comments-popover";
import { MergeCardDialog } from "@/components/retro/merge-card-dialog";
import { deleteCard, moveCard, toggleReaction, toggleVote, ungroupCard, updateCard } from "@/server/actions/retros";
import type { RetroCardWithRelations } from "@/server/queries/retros";
import { REACTIONS } from "@/lib/retroReactions";
import { useAction } from "@/lib/useAction";

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

type MenuAction = { label: string; onSelect: () => void; danger?: boolean; separatorBefore?: boolean };

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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const [isEditing, setIsEditing] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [draft, setDraft] = useState(card.content);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
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
          voteCount: state.voteCount === null ? null : state.voteCount + (state.hasVoted ? -1 : 1),
        };
      }

      const existing = state.reactions.find((r) => r.emoji === change.emoji);
      const mine = existing?.mine ?? false;
      const nextCount = (existing?.count ?? 0) + (mine ? -1 : 1);
      const others = state.reactions.filter((r) => r.emoji !== change.emoji);

      return {
        ...state,
        reactions: nextCount > 0 ? [...others, { emoji: change.emoji, count: nextCount, mine: !mine }] : others,
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

  const menuItems: MenuAction[] = [{ label: "Edit", onSelect: () => setIsEditing(true) }];

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
        onSelect: () => run(() => moveCard({ retrospectiveId, cardId: card.id, toColumnId: target.id, toIndex: target.cardCount })),
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
    danger: true,
    separatorBefore: true,
    onSelect: () => run(() => deleteCard(retrospectiveId, card.id)),
  });

  return (
    <Paper
      ref={setNodeRef}
      variant="outlined"
      className="group"
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1,
        p: 1.5,
        opacity: isDragging ? 0.5 : 1,
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
        // Everyone's board marks the same card, so "the one we're on" is never
        // ambiguous mid-discussion.
        ...(isUnderDiscussion && { borderColor: "primary.main", borderWidth: 2, boxShadow: (theme) => `0 0 0 2px ${theme.palette.primary.light}` }),
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
        {/* `touchAction: none` is not cosmetic: without it the browser claims the
            gesture for scrolling and a touch drag never starts at all. The
            label matters for the same reason — this was an unnamed icon
            button, so a screen reader announced nothing. */}
        <Box
          component="button"
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Move card: ${card.content.slice(0, 40)}`}
          sx={{
            mt: 0.25,
            flexShrink: 0,
            cursor: "grab",
            touchAction: "none",
            border: "none",
            background: "none",
            color: "text.secondary",
            display: "flex",
            "&:hover": { color: "text.primary" },
            "&:active": { cursor: "grabbing" },
          }}
        >
          <GripVertical className="h-4 w-4" />
        </Box>

        {isEditing ? (
          <Stack spacing={1} sx={{ flex: 1 }}>
            <TextField value={draft} onChange={(e) => setDraft(e.target.value)} multiline minRows={2} size="small" autoFocus />
            <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
              <IconButton size="small" aria-label="Cancel edit" onClick={() => setIsEditing(false)}>
                <X className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton size="small" color="primary" aria-label="Save edit" onClick={saveEdit}>
                <Check className="h-3.5 w-3.5" />
              </IconButton>
            </Stack>
          </Stack>
        ) : (
          <Typography variant="body2" sx={{ flex: 1, whiteSpace: "pre-wrap" }}>
            {card.content}
          </Typography>
        )}

        {canEdit && !isEditing && (
          <Box className="reveal-on-hover" sx={{ flexShrink: 0 }}>
            <IconButton size="small" aria-label={`Card actions for "${card.content.slice(0, 30)}"`} onClick={(e: MouseEvent<HTMLElement>) => setMenuAnchor(e.currentTarget)}>
              <MoreVertical className="size-3.5" />
            </IconButton>
            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
              {menuItems.map((item, i) => [
                item.separatorBefore && <Divider key={`${i}-divider`} />,
                <MenuItem
                  key={i}
                  onClick={() => {
                    setMenuAnchor(null);
                    item.onSelect();
                  }}
                  sx={item.danger ? { color: "error.main" } : undefined}
                >
                  {item.label}
                </MenuItem>,
              ])}
            </Menu>
          </Box>
        )}
      </Stack>

      {card.grouped.length > 0 && <Chip icon={<Layers className="h-3 w-3" />} label={`+${card.grouped.length} merged`} size="small" sx={{ width: "fit-content" }} />}

      <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", minWidth: 0, flex: 1 }}>
          <Avatar sx={{ width: 22, height: 22, fontSize: 11 }}>{authorName.slice(0, 1).toUpperCase()}</Avatar>
          <Typography variant="caption" color="text.secondary" noWrap>
            {authorName}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexShrink: 0 }}>
          {REACTIONS.map((emoji) => {
            const reaction = optimistic.reactions.find((r) => r.emoji === emoji);
            const count = reaction?.count ?? 0;
            const mine = reaction?.mine ?? false;
            return (
              <Chip
                key={emoji}
                component="button"
                disabled={!canReact}
                aria-pressed={mine}
                aria-label={`${mine ? "Remove" : "Add"} ${emoji} reaction${count > 0 ? ` (${count})` : ""}`}
                onClick={() =>
                  run(() => toggleReaction(retrospectiveId, card.id, emoji), {
                    optimistic: () => applyOptimistic({ type: "reaction", emoji }),
                  })
                }
                label={count > 0 ? `${emoji} ${count}` : emoji}
                size="small"
                color={mine ? "primary" : "default"}
                variant={mine ? "filled" : "outlined"}
                sx={{ cursor: canReact ? "pointer" : "default" }}
              />
            );
          })}

          <CardCommentsPopover retrospectiveId={retrospectiveId} card={card} canComment={canComment} />

          <Button
            variant="text"
            size="small"
            disabled={!canVote}
            aria-pressed={hasVoted}
            aria-label={optimistic.voteCount === null ? `${hasVoted ? "Remove your vote" : "Vote"} (tally hidden until voting ends)` : `${hasVoted ? "Remove your vote" : "Vote"} (${optimistic.voteCount})`}
            color={hasVoted ? "error" : "inherit"}
            onClick={() =>
              run(() => toggleVote(retrospectiveId, card.id), {
                optimistic: () => applyOptimistic({ type: "vote" }),
              })
            }
            startIcon={<Heart className="h-3.5 w-3.5" fill={hasVoted ? "currentColor" : "none"} />}
          >
            {optimistic.voteCount}
          </Button>
        </Stack>
      </Stack>

      {isMerging && <MergeCardDialog retrospectiveId={retrospectiveId} card={card} siblingCards={siblingCards} onClose={() => setIsMerging(false)} />}
    </Paper>
  );
}
