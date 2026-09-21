"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import { assignUserToProject } from "@/server/actions/users";
import { removeProjectMember } from "@/server/actions/invitations";
import { useAction } from "@/lib/useAction";

type CompanyOption = { id: string; name: string; projects: { id: string; name: string }[] };
type CurrentProject = { id: string; name: string; companyName: string };

type Props = {
  onClose: () => void;
  userId: string;
  userName: string;
  companies: CompanyOption[];
  currentProjects: CurrentProject[];
};

/** Super Admin console: add/remove a user's project assignments across every company. */
export function ManageUserProjectsDialog({ onClose, userId, userName, companies, currentProjects }: Props) {
  const { run, isPending } = useAction();
  const [selected, setSelected] = useState("");

  const availableOptions = useMemo(() => {
    const assigned = new Set(currentProjects.map((p) => p.id));
    return companies.flatMap((c) =>
      c.projects.filter((p) => !assigned.has(p.id)).map((p) => ({ value: p.id, label: `${c.name} / ${p.name}` })),
    );
  }, [companies, currentProjects]);

  function addProject() {
    if (!selected) return;
    run(() => assignUserToProject(userId, selected), {
      onSuccess: () => {
        toast.success("Added to project");
        setSelected("");
      },
    });
  }

  function removeProject(projectId: string) {
    run(() => removeProjectMember(projectId, userId), {
      onSuccess: () => toast.success("Removed from project"),
    });
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-label={`Manage projects for ${userName}`}>
      <DialogTitle>Projects for {userName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Stack spacing={1}>
            {currentProjects.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Not on any projects yet.
              </Typography>
            ) : (
              currentProjects.map((p) => (
                <Paper
                  key={p.id}
                  variant="outlined"
                  sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1.5, py: 1 }}
                >
                  <Typography variant="body2">
                    {p.companyName} / {p.name}
                  </Typography>
                  <IconButton
                    aria-label={`Remove from ${p.name}`}
                    size="small"
                    disabled={isPending}
                    onClick={() => removeProject(p.id)}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Paper>
              ))
            )}
          </Stack>

          {availableOptions.length > 0 && (
            <Stack direction="row" spacing={1} sx={{ alignItems: "flex-end" }}>
              <TextField
                select
                label="Add to project"
                fullWidth
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <MenuItem value="">Choose a project</MenuItem>
                {availableOptions.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
              <Button variant="outlined" onClick={addProject} disabled={isPending || !selected}>
                Add
              </Button>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
