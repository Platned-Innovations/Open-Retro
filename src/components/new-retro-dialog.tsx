"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import { createRetrospective } from "@/server/actions/retros";
import { TEMPLATE_LABELS } from "@/lib/retroTemplates";
import type { RetroTemplate } from "@/generated/prisma/client";

const TEMPLATES = Object.keys(TEMPLATE_LABELS) as RetroTemplate[];

export function NewRetroDialog({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<RetroTemplate>("START_STOP_CONTINUE");
  const [customColumns, setCustomColumns] = useState<string[]>(["", ""]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isGuided, setIsGuided] = useState(true);
  const [hideOthersCards, setHideOthersCards] = useState(true);
  const [voteBudget, setVoteBudget] = useState("5");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const result = await createRetrospective({
          projectId,
          title,
          template,
          customColumns: template === "CUSTOM" ? customColumns.filter(Boolean) : undefined,
          isAnonymous,
          isGuided,
          hideOthersCards,
          voteBudget: Number(voteBudget),
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setOpen(false);
        router.push(`/retros/${result.data.id}`);
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  return (
    <>
      <Button variant="contained" size="small" onClick={() => setOpen(true)} startIcon={<Plus className="h-4 w-4" />}>
        New retrospective
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs" aria-label="New retrospective">
        <form onSubmit={handleSubmit}>
          <DialogTitle>New retrospective</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>Pick a format for the board.</DialogContentText>
            <Stack spacing={2}>
              <TextField
                label="Title"
                required
                fullWidth
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Sprint 42 Retrospective"
              />
              <TextField select label="Template" fullWidth value={template} onChange={(e) => setTemplate(e.target.value as RetroTemplate)}>
                {TEMPLATES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {TEMPLATE_LABELS[t]}
                  </MenuItem>
                ))}
              </TextField>

              {template === "CUSTOM" && (
                <Stack spacing={1}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Columns
                  </Typography>
                  {customColumns.map((col, i) => (
                    <Stack key={i} direction="row" spacing={1}>
                      <TextField
                        fullWidth
                        size="small"
                        value={col}
                        onChange={(e) => setCustomColumns((cols) => cols.map((c, idx) => (idx === i ? e.target.value : c)))}
                        placeholder={`Column ${i + 1}`}
                      />
                      <IconButton
                        type="button"
                        size="small"
                        aria-label={`Remove column ${i + 1}`}
                        onClick={() => setCustomColumns((cols) => cols.filter((_, idx) => idx !== i))}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                  <Button type="button" size="small" onClick={() => setCustomColumns((cols) => [...cols, ""])}>
                    Add column
                  </Button>
                </Stack>
              )}

              <FormControlLabel
                control={<Checkbox checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />}
                label="Anonymous cards (hide who wrote each card)"
              />

              <FormControlLabel
                control={<Checkbox checked={isGuided} onChange={(e) => setIsGuided(e.target.checked)} />}
                label="Guided session (step the group through collect, group, vote, discuss)"
              />

              {/* Only meaningful inside a guided session — without phases there
                  is no COLLECT to hide during, and no VOTE to budget. */}
              {isGuided && (
                <Box sx={{ borderLeft: 2, borderColor: "divider", pl: 2 }}>
                  <Stack spacing={1.5}>
                    <FormControlLabel
                      control={<Checkbox checked={hideOthersCards} onChange={(e) => setHideOthersCards(e.target.checked)} />}
                      label="Hide other people's cards while collecting (avoids anchoring)"
                    />
                    <TextField select label="Votes per person" fullWidth value={voteBudget} onChange={(e) => setVoteBudget(e.target.value)}>
                      <MenuItem value="0">Unlimited</MenuItem>
                      <MenuItem value="3">3 votes</MenuItem>
                      <MenuItem value="5">5 votes</MenuItem>
                      <MenuItem value="7">7 votes</MenuItem>
                    </TextField>
                  </Stack>
                </Box>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="submit" variant="contained" disabled={isPending}>
              Start retrospective
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
