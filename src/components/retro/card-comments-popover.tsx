"use client";

import { useState, type MouseEvent } from "react";
import { MessageCircle, Send } from "lucide-react";
import Popover from "@mui/material/Popover";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
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
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { run, isPending } = useAction();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    run(() => addComment({ retrospectiveId, cardId: card.id, content: value.trim() }), {
      onSuccess: () => setValue(""),
    });
  }

  return (
    <>
      <Button variant="text" size="small" startIcon={<MessageCircle className="h-3.5 w-3.5" />} onClick={(e: MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)}>
        {card.comments.length > 0 && card.comments.length}
      </Button>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ width: 288, p: 1.5 }}>
          <Stack spacing={1} sx={{ maxHeight: 192, overflowY: "auto" }}>
            {card.comments.length === 0 && (
              <Typography variant="caption" color="text.secondary">
                No comments yet.
              </Typography>
            )}
            {card.comments.map((comment) => {
              const authorName = comment.authorName ?? "Anonymous";
              return (
                <Stack key={comment.id} direction="row" spacing={1}>
                  <Avatar sx={{ width: 24, height: 24, fontSize: 11 }}>{authorName.slice(0, 1).toUpperCase()}</Avatar>
                  <Typography variant="body2">
                    <Typography component="span" variant="body2" sx={{ fontWeight: 500 }}>
                      {authorName}
                    </Typography>{" "}
                    <Typography component="span" variant="body2" color="text.secondary">
                      {comment.content}
                    </Typography>
                  </Typography>
                </Stack>
              );
            })}
          </Stack>
          {canComment && (
            <Stack component="form" onSubmit={handleSubmit} direction="row" spacing={0.5} sx={{ mt: 1.5 }}>
              <TextField size="small" fullWidth value={value} onChange={(e) => setValue(e.target.value)} placeholder="Add a comment…" />
              <IconButton type="submit" size="small" aria-label="Send comment" disabled={isPending}>
                <Send className="h-3.5 w-3.5" />
              </IconButton>
            </Stack>
          )}
        </Box>
      </Popover>
    </>
  );
}
