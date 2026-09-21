"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import { createProject } from "@/server/actions/projects";
import { useAction } from "@/lib/useAction";

export function NewProjectDialog({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { run, isPending } = useAction();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    run(() => createProject({ companyId, name, description: description || undefined }), {
      onSuccess: () => {
        toast.success(`Project "${name}" created`);
        setOpen(false);
        setName("");
        setDescription("");
      },
    });
  }

  return (
    <>
      <Button variant="outlined" size="small" onClick={() => setOpen(true)} startIcon={<Plus className="h-4 w-4" />}>
        New project
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs" aria-label={`New project in ${companyName}`}>
        <form onSubmit={handleSubmit}>
          <DialogTitle>New project in {companyName}</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              Any member of {companyName} can create additional projects.
            </DialogContentText>
            <Stack spacing={2}>
              <TextField label="Project name" required fullWidth value={name} onChange={(e) => setName(e.target.value)} />
              <TextField
                label="Description (optional)"
                multiline
                minRows={2}
                fullWidth
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="submit" variant="contained" disabled={isPending}>
              Create project
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
