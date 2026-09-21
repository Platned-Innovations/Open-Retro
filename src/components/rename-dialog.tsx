"use client";

import { useState, useTransition } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";

type Props = {
  onClose: () => void;
  currentName: string;
  label: string;
  /**
   * Resolves true when the rename went through. The dialog used to rely on
   * `onSave` throwing to know it had failed; actions return a result now, so
   * the outcome has to be handed back explicitly or a refused rename would
   * close the dialog as though it had worked.
   */
  onSave: (name: string) => Promise<boolean>;
};

/**
 * Controlled name-edit dialog shared by the member list and the admin console.
 * Mount it only while open (e.g. `{open && <RenameDialog ... />}`) — that's
 * what gives `name` a fresh starting value from `currentName` each time.
 */
export function RenameDialog({ onClose, currentName, label, onSave }: Props) {
  const [name, setName] = useState(currentName);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      // `onSave` surfaces its own message; this only decides whether to close.
      if (await onSave(trimmed)) onClose();
    });
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-label={label}>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{label}</DialogTitle>
        <DialogContent>
          <TextField
            label="Name"
            required
            autoFocus
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button type="submit" variant="contained" disabled={isPending}>
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
