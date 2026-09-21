"use client";

import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import { configureRetroFlow } from "@/server/actions/retros";
import type { RetroBoard } from "@/server/queries/retros";
import { useAction } from "@/lib/useAction";

const VOTE_BUDGETS = [
  { value: "0", label: "Unlimited" },
  { value: "3", label: "3 votes" },
  { value: "5", label: "5 votes" },
  { value: "7", label: "7 votes" },
  { value: "10", label: "10 votes" },
];

const DISCUSS_DURATIONS = [
  { value: "180", label: "3 min per card" },
  { value: "300", label: "5 min per card" },
  { value: "600", label: "10 min per card" },
];

/** How the facilitator shapes this particular session. Moderators only. */
export function PhaseSettingsDialog({ retro, onClose }: { retro: RetroBoard; onClose: () => void }) {
  const { run, isPending } = useAction();
  const [isGuided, setIsGuided] = useState(retro.isGuided);
  const [hideOthersCards, setHideOthersCards] = useState(retro.hideOthersCards);
  const [hideVoteCounts, setHideVoteCounts] = useState(retro.hideVoteCounts);
  const [checkInEnabled, setCheckInEnabled] = useState(retro.checkInEnabled);
  const [voteBudget, setVoteBudget] = useState(String(retro.voteBudget));
  const [discussSeconds, setDiscussSeconds] = useState(String(retro.discussSeconds));

  function save() {
    run(
      () =>
        configureRetroFlow({
          retrospectiveId: retro.id,
          isGuided,
          // Only sent when it can still be honoured, so the action's refusal is
          // reserved for a genuine attempt rather than a stale form value.
          ...(retro.canHideCards ? { hideOthersCards } : {}),
          hideVoteCounts,
          checkInEnabled,
          voteBudget: Number(voteBudget),
          discussSeconds: Number(discussSeconds),
        }),
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-label="Session settings">
      <DialogTitle>Session settings</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <FormControlLabel control={<Switch checked={isGuided} onChange={(e) => setIsGuided(e.target.checked)} />} label="Guided session" />
            <Typography variant="caption" color="text.secondary">
              Off means every activity stays open at once, the way a board worked before phases existed.
            </Typography>
          </Stack>

          <Stack spacing={0.5}>
            <FormControlLabel
              control={
                <Switch checked={hideOthersCards} onChange={(e) => setHideOthersCards(e.target.checked)} disabled={!retro.canHideCards} />
              }
              label="Hide other people's cards while collecting"
            />
            {!retro.canHideCards && (
              <Alert severity="info">
                Cards on this board have already been revealed. Hiding them again wouldn&apos;t un-see them, so this can&apos;t be
                switched back on.
              </Alert>
            )}
          </Stack>

          <FormControlLabel
            control={<Switch checked={hideVoteCounts} onChange={(e) => setHideVoteCounts(e.target.checked)} />}
            label="Hide vote counts until voting ends"
          />

          <Stack spacing={0.5}>
            <FormControlLabel
              control={<Switch checked={checkInEnabled} onChange={(e) => setCheckInEnabled(e.target.checked)} />}
              label="Team health check-in"
            />
            <Typography variant="caption" color="text.secondary">
              Adds a step before the board: five anonymous questions about the last sprint. Answers stay hidden until enough people
              have replied.
            </Typography>
          </Stack>

          <TextField select label="Votes per person" fullWidth value={voteBudget} onChange={(e) => setVoteBudget(e.target.value)}>
            {VOTE_BUDGETS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField select label="Discussion time" fullWidth value={discussSeconds} onChange={(e) => setDiscussSeconds(e.target.value)}>
            {DISCUSS_DURATIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={isPending}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
