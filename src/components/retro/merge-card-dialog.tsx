"use client";

import { useMemo, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import { groupCards } from "@/server/actions/retros";
import type { RetroCardWithRelations } from "@/server/queries/retros";
import { useAction } from "@/lib/useAction";

/** Enough to scan; beyond this, typing is faster than scrolling anyway. */
const MAX_SHOWN = 20;

/**
 * Picking the card to merge into.
 *
 * Replaces one dropdown item per other card in the column. That menu was
 * O(n²) — a 40-card column built 40 menus of 39 items, 1,560 array entries on
 * every render — and unusable long before it was slow: a 39-item menu is not
 * something anyone reads.
 *
 * The sibling list arrives as one shared array and is filtered here, only
 * while the dialog is open, so the cost is paid by the person who asked for
 * it rather than by every card on every render.
 */
export function MergeCardDialog({
  retrospectiveId,
  card,
  siblingCards,
  onClose,
}: {
  retrospectiveId: string;
  card: RetroCardWithRelations;
  siblingCards: RetroCardWithRelations[];
  onClose: () => void;
}) {
  const { run, isPending } = useAction();
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return siblingCards.filter((c) => c.id !== card.id && (!q || c.content.toLowerCase().includes(q))).slice(0, MAX_SHOWN);
  }, [siblingCards, card.id, query]);

  const total = siblingCards.length - 1;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-label="Merge this card into another">
      <DialogTitle>Merge into…</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            &ldquo;{card.content.slice(0, 80)}
            {card.content.length > 80 ? "…" : ""}&rdquo; will be stacked under the card you pick.
          </Typography>

          {total > MAX_SHOWN && (
            <TextField size="small" fullWidth value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this column…" autoFocus />
          )}

          {matches.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 2 }}>
              {total === 0 ? "There is nothing else in this column yet." : "No card matches that."}
            </Typography>
          ) : (
            <List dense disablePadding sx={{ maxHeight: 288, overflowY: "auto" }}>
              {matches.map((target) => (
                <ListItemButton
                  key={target.id}
                  disabled={isPending}
                  onClick={() => run(() => groupCards(retrospectiveId, card.id, target.id), { onSuccess: onClose })}
                  sx={{ border: 1, borderColor: "divider", borderRadius: 1, mb: 0.5 }}
                >
                  <ListItemText primary={target.content} />
                </ListItemButton>
              ))}
            </List>
          )}

          {total > matches.length && (
            <Typography variant="caption" color="text.secondary">
              Showing {matches.length} of {total}. Type to narrow it down.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
