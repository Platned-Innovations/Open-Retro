"use client";

import { ChevronLeft, ChevronRight, ListChecks, MessageSquareText } from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  IconButton,
  ProgressBar,
  StatusBadge,
} from "@platned/ui";
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

  const topLevel = retro.columns
    .flatMap((column) => column.cards.map((card) => ({ card, column })))
    .filter(({ card }) => !card.groupId);

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
      <Card>
        <CardBody>
          <EmptyState
            icon={<MessageSquareText className="h-8 w-8" />}
            message={
              running.length === 0
                ? "No cards to discuss yet."
                : "No card selected — pick one to start the discussion."
            }
          />
        </CardBody>
      </Card>
    );
  }

  const { card, column } = current;
  const position = currentIndex + 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle size="md" className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column.color }} />
          Discussing · {column.title}
        </CardTitle>
      </CardHeader>
      <CardBody className="gap-4">
        <p className="whitespace-pre-wrap text-body text-default">{card.content}</p>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            label={`${effectiveVoteCount(card)} vote${effectiveVoteCount(card) === 1 ? "" : "s"}`}
            tone="info"
            size="sm"
          />
          {card.grouped.length > 0 && (
            <StatusBadge label={`+${card.grouped.length} merged`} tone="neutral" size="sm" />
          )}
          <span className="text-body-tiny text-default-secondary">
            {card.authorName ?? "Anonymous"}
          </span>
        </div>

        {card.comments.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-default pt-3">
            {card.comments.map((comment) => (
              <p key={comment.id} className="text-body-sm text-default-secondary">
                <span className="font-medium text-default">
                  {comment.authorName ?? "Anonymous"}
                </span>{" "}
                {comment.content}
              </p>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-default pt-3">
          <div className="flex items-center gap-3">
            <ProgressBar
              value={(position / running.length) * 100}
              size="sm"
              className="w-24"
              aria-label={`Card ${position} of ${running.length}`}
            />
            <span className="text-body-tiny text-default-secondary">
              {position} of {running.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="neutral"
              size="sm"
              onClick={() => onCreateActionItem(card.content)}
              leadingIcon={<ListChecks className="h-3.5 w-3.5" />}
            >
              Create action item
            </Button>

            {canModerate && (
              <>
                <RetroTimer
                  retrospectiveId={retro.id}
                  timerEndsAt={retro.timerEndsAt}
                  canModerate={canModerate}
                />
                <IconButton
                  variant="neutral"
                  size="sm"
                  aria-label="Previous card"
                  disabled={isPending || position === 1}
                  onClick={() =>
                    run(() => advanceDiscussion({ retrospectiveId: retro.id, direction: "previous" }))
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </IconButton>
                <IconButton
                  variant="neutral"
                  size="sm"
                  aria-label="Next card"
                  disabled={isPending || position === running.length}
                  onClick={() =>
                    run(() => advanceDiscussion({ retrospectiveId: retro.id, direction: "next" }))
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </IconButton>
              </>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
