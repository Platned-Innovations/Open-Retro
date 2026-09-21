"use client";

import { ChevronLeft, ChevronRight, ListChecks, MessageSquareText } from "lucide-react";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import { RetroTimer } from "@/components/retro/retro-timer";
import { advanceDiscussion } from "@/server/actions/retros";
import type { RetroBoard } from "@/server/queries/retros";
import { effectiveVoteCount } from "@/lib/retroVotes";
import { useAction } from "@/lib/useAction";

/**
 * The card the group is talking about, front and centre.
 *
 * The running order is decided on the server, so everyone's "next" is the same
 * card — a client-side ordering would drift the moment two people had slightly
 * different data, and the facilitator would be discussing one card while half
 * the room looked at another.
 */
export function DiscussionFocus({
  retro,
  onCreateActionItem,
}: {
  retro: RetroBoard;
  onCreateActionItem: (cardContent: string) => void;
}) {
  const { run, isPending } = useAction();
  const { canModerate } = retro.viewer;

  const topLevel = retro.columns.flatMap((column) => column.cards.map((card) => ({ card, column }))).filter(({ card }) => !card.groupId);

  // Mirrors the server's ordering so the progress count matches what the
  // facilitator is actually stepping through.
  const ordered = [...topLevel]
    .filter(({ card }) => effectiveVoteCount(card) > 0)
    .sort((a, b) => effectiveVoteCount(b.card) - effectiveVoteCount(a.card));
  const running = ordered.length > 0 ? ordered : topLevel;

  const currentIndex = running.findIndex(({ card }) => card.id === retro.discussCardId);
  const current = currentIndex >= 0 ? running[currentIndex] : undefined;

  if (!current) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1} sx={{ py: 4, alignItems: "center", color: "text.secondary" }}>
            <MessageSquareText className="h-8 w-8" style={{ opacity: 0.5 }} />
            <Typography variant="body2" color="text.secondary">
              {running.length === 0 ? "No cards to discuss yet." : "No card selected — pick one to start the discussion."}
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const { card, column } = current;
  const position = currentIndex + 1;

  return (
    <Card variant="outlined">
      <CardHeader
        title={
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: column.color }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Discussing · {column.title}
            </Typography>
          </Stack>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        <Stack spacing={2}>
          <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
            {card.content}
          </Typography>

          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Chip label={`${effectiveVoteCount(card)} vote${effectiveVoteCount(card) === 1 ? "" : "s"}`} color="info" size="small" />
            {card.grouped.length > 0 && <Chip label={`+${card.grouped.length} merged`} size="small" />}
            <Typography variant="caption" color="text.secondary">
              {card.authorName ?? "Anonymous"}
            </Typography>
          </Stack>

          {card.comments.length > 0 && (
            <Stack spacing={0.75} sx={{ borderTop: 1, borderColor: "divider", pt: 1.5 }}>
              {card.comments.map((comment) => (
                <Typography key={comment.id} variant="body2" color="text.secondary">
                  <Typography component="span" variant="body2" sx={{ fontWeight: 500, color: "text.primary" }}>
                    {comment.authorName ?? "Anonymous"}
                  </Typography>{" "}
                  {comment.content}
                </Typography>
              ))}
            </Stack>
          )}

          <Stack
            direction="row"
            spacing={1.5}
            sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", borderTop: 1, borderColor: "divider", pt: 1.5 }}
          >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <LinearProgress
                variant="determinate"
                value={(position / running.length) * 100}
                aria-label={`Card ${position} of ${running.length}`}
                sx={{ width: 96, height: 6, borderRadius: 3 }}
              />
              <Typography variant="caption" color="text.secondary">
                {position} of {running.length}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Button variant="outlined" size="small" onClick={() => onCreateActionItem(card.content)} startIcon={<ListChecks className="h-3.5 w-3.5" />}>
                Create action item
              </Button>

              {canModerate && (
                <>
                  <RetroTimer retrospectiveId={retro.id} timerEndsAt={retro.timerEndsAt} canModerate={canModerate} />
                  <IconButton
                    size="small"
                    aria-label="Previous card"
                    disabled={isPending || position === 1}
                    onClick={() => run(() => advanceDiscussion({ retrospectiveId: retro.id, direction: "previous" }))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="Next card"
                    disabled={isPending || position === running.length}
                    onClick={() => run(() => advanceDiscussion({ retrospectiveId: retro.id, direction: "next" }))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </IconButton>
                </>
              )}
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
