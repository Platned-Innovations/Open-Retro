"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
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

/** Super Admin only: defining a brand new company happens by creating its first project. */
export function NewCompanyDialog() {
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [projectName, setProjectName] = useState("");
  const { run, isPending } = useAction();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    run(() => createProject({ newCompanyName: companyName, name: projectName }), {
      onSuccess: () => {
        toast.success(`${companyName} created with project "${projectName}"`);
        setOpen(false);
        setCompanyName("");
        setProjectName("");
      },
    });
  }

  return (
    <>
      <Button variant="contained" size="small" onClick={() => setOpen(true)} startIcon={<Building2 className="h-4 w-4" />}>
        New company
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs" aria-label="New company">
        <form onSubmit={handleSubmit}>
          <DialogTitle>New company</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>Every company needs at least one project to start with.</DialogContentText>
            <Stack spacing={2}>
              <TextField
                label="Company name"
                required
                fullWidth
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
              <TextField
                label="First project name"
                required
                fullWidth
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="submit" variant="contained" disabled={isPending}>
              Create company
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
