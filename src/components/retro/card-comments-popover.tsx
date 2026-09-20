"use client";

import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { Button, IconButton, Input, Avatar } from "@platned/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addComment } from "@/server/actions/retros";
import type { RetroCardWithRelations } from "@/server/queries/retros";
import { useAction } from "@/lib/useAction";

export function CardCommentsPopover({
  retrospectiveId,
  card,
  canComment,
}: {
  retrospectiveId: string;
  card: RetroCardWithRelations;
  /** Existing comments stay readable when false — only adding one is gated. */
  canComment: boolean;
}) {
  const [value, setValue] = useState("");
  const { run, isPending } = useAction();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    run(() => addComment({ retrospectiveId, cardId: card.id, content: value.trim() }), {
      onSuccess: () => setValue(""),
    });
  }

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="subtle" size="sm" leadingIcon={<MessageCircle className="h-3.5 w-3.5" />} />}
      >
        {card.comments.length > 0 && card.comments.length}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
          {card.comments.length === 0 && (
            <p className="text-body-tiny text-default-secondary">No comments yet.</p>
          )}
          {card.comments.map((comment) => {
            const authorName = comment.authorName ?? "Anonymous";
            return (
              <div key={comment.id} className="flex gap-2 text-body-sm">
                <Avatar type="initial" initial={authorName.slice(0, 1).toUpperCase()} size="sm" />
                <div>
                  <span className="font-medium text-default">{authorName}</span>{" "}
                  <span className="text-default-secondary">{comment.content}</span>
                </div>
              </div>
            );
          })}
        </div>
        {canComment && (
          <form onSubmit={handleSubmit} className="mt-2 flex gap-1">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Add a comment…"
              className="flex-1"
            />
            <IconButton type="submit" aria-label="Send comment" disabled={isPending}>
              <Send className="h-3.5 w-3.5" />
            </IconButton>
          </form>
        )}
      </PopoverContent>
    </Popover>
  );
}
