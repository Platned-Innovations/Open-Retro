"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Alert from "@mui/material/Alert";
import LinearProgress from "@mui/material/LinearProgress";
import { PhaseSettingsDialog } from "@/components/retro/phase-settings-dialog";
import { stepRetroPhase } from "@/server/actions/retros";
import type { RetroBoard } from "@/server/queries/retros";
import { PHASE_HINTS, PHASE_LABELS, nextPhase, previousPhase, toStepperSteps } from "@/lib/retroPhases";
import { useAction } from "@/lib/useAction";

/**
 * The session's control surface: where everyone is, what this step is for, and
 * (for a moderator) how to move on.
 *
 * MUI's Stepper is display-only for this use — no `onClick` per step — which
 * suits the original intent: jumping the group to an arbitrary step by
 * clicking a label is rarely what anyone means, so navigation is the explicit
 * Back/Next pair.
 */
export function PhaseBar({ retro }: { retro: RetroBoard }) {
  const { run, isPending } = useAction();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { canModerate } = retro.viewer;
  const flow = { checkInEnabled: retro.checkInEnabled };
  const steps = toStepperSteps(retro.phase, flow);
  const activeStep = steps.findIndex((s) => s.status === "active");
  const next = nextPhase(retro.phase, flow);
  const previous = previousPhase(retro.phase, flow);

  const spent = retro.voteBudget - (retro.votesRemaining ?? 0);
  const showVoteBudget = retro.phase === "VOTE" && retro.votesRemaining !== null;

  return (
    <Paper variant="outlined" sx={{ p: 2.5, bgcolor: "action.hover" }}>
      <Stack spacing={2}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {steps.map((step) => (
            <Step key={step.label}>
              <StepLabel>{step.label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            {PHASE_HINTS[retro.phase]}
          </Typography>

          {canModerate && (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0 }}>
              <IconButton size="small" aria-label="Session settings" onClick={() => setSettingsOpen(true)}>
                <Settings2 className="h-4 w-4" />
              </IconButton>
              <IconButton
                size="small"
                aria-label={previous ? `Back to ${PHASE_LABELS[previous]}` : "Already at the first step"}
                disabled={!previous || isPending}
                onClick={() => run(() => stepRetroPhase({ retrospectiveId: retro.id, direction: "previous" }))}
              >
                <ChevronLeft className="h-4 w-4" />
              </IconButton>
              <Button
                variant="contained"
                size="small"
                disabled={!next || isPending}
                onClick={() => run(() => stepRetroPhase({ retrospectiveId: retro.id, direction: "next" }))}
                endIcon={<ChevronRight className="h-3.5 w-3.5" />}
              >
                {next ? `Next: ${PHASE_LABELS[next]}` : "Finished"}
              </Button>
            </Stack>
          )}
        </Stack>

        {showVoteBudget && (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <LinearProgress
              variant="determinate"
              value={retro.voteBudget === 0 ? 0 : (spent / retro.voteBudget) * 100}
              color={retro.votesRemaining === 0 ? "warning" : "primary"}
              aria-label={`${retro.votesRemaining} of ${retro.voteBudget} votes remaining`}
              sx={{ width: "100%", maxWidth: 192, height: 6, borderRadius: 3 }}
            />
            <Typography variant="body2" color="text.secondary">
              {retro.votesRemaining} of {retro.voteBudget} votes left
            </Typography>
          </Stack>
        )}

        {/* Non-moderators get told what is happening rather than left to guess
            why the board stopped accepting what they were doing a moment ago. */}
        {!canModerate && retro.phase !== "CLOSED" && <Alert severity="info">The facilitator moves everyone on together.</Alert>}

        {settingsOpen && <PhaseSettingsDialog retro={retro} onClose={() => setSettingsOpen(false)} />}
      </Stack>
    </Paper>
  );
}
