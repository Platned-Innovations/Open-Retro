"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import {
  inviteUserToProject,
  inviteUserToCompany,
  addExistingMemberToProject,
} from "@/server/actions/invitations";
import type { MembershipRole } from "@/generated/prisma/client";
import type { MemberUser } from "@/types/member";

type Props = (
  | {
      target: "project";
      targetId: string;
      targetName: string;
      /** Company members not yet on this project — lets an admin skip the email round-trip. */
      addableMembers: MemberUser[];
    }
  | { target: "company"; targetId: string; targetName: string }
) & {
  /** Only admins (or Super Admin) can invite/add someone as an admin — hide the option otherwise. */
  isViewerAdmin: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Splits on commas, whitespace, and newlines; dedupes; separates valid from invalid-looking addresses. */
function parseEmails(text: string): { valid: string[]; invalid: string[] } {
  const raw = text
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(raw)];
  const valid = unique.filter((e) => EMAIL_RE.test(e));
  const invalid = unique.filter((e) => !EMAIL_RE.test(e));
  return { valid, invalid };
}

function RoleField({
  role,
  onChange,
  hint,
}: {
  role: MembershipRole;
  onChange: (role: MembershipRole) => void;
  hint: string;
}) {
  return (
    <TextField select label="Role" helperText={hint} fullWidth value={role} onChange={(e) => onChange(e.target.value as MembershipRole)}>
      <MenuItem value="MEMBER">Member</MenuItem>
      <MenuItem value="ADMIN">Admin</MenuItem>
    </TextField>
  );
}

function EmailInviteForm({
  target,
  targetId,
  isViewerAdmin,
  onDone,
}: {
  target: "project" | "company";
  targetId: string;
  isViewerAdmin: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [emailsText, setEmailsText] = useState("");
  const [role, setRole] = useState<MembershipRole>("MEMBER");
  const [isPending, startTransition] = useTransition();

  const { valid: validEmails, invalid: invalidEmails } = parseEmails(emailsText);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validEmails.length === 0) {
      toast.error("Enter at least one valid email address");
      return;
    }

    startTransition(async () => {
      const results = await Promise.allSettled(
        validEmails.map((email) =>
          target === "project"
            ? inviteUserToProject({ projectId: targetId, email, role })
            : inviteUserToCompany({ companyId: targetId, email, role }),
        ),
      );

      // A refused invite now *resolves* with { ok: false } rather than
      // rejecting, so counting fulfilled promises would report every failure as
      // a success — "Invited 5 people" when none of them were.
      const succeeded = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
      const failed = results
        .map((r, i) => (r.status === "fulfilled" && r.value.ok ? null : validEmails[i]))
        .filter((email): email is string => email !== null);

      const firstError = results.find(
        (r): r is PromiseFulfilledResult<{ ok: false; error: string }> => r.status === "fulfilled" && !r.value.ok,
      )?.value.error;

      if (succeeded > 0) {
        toast.success(succeeded === 1 ? `Invited ${validEmails[0]}` : `Invited ${succeeded} people`);
      }
      if (failed.length > 0) {
        toast.error(
          firstError ? `Couldn't invite ${failed.join(", ")}: ${firstError}` : `Failed to invite: ${failed.join(", ")}`,
        );
      }
      if (invalidEmails.length > 0) {
        toast.warning(`Skipped invalid address${invalidEmails.length > 1 ? "es" : ""}: ${invalidEmails.join(", ")}`);
      }

      if (succeeded > 0) {
        setEmailsText("");
        setRole("MEMBER");
        router.refresh();
        onDone();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2}>
          <TextField
            label="Emails"
            required
            multiline
            minRows={3}
            fullWidth
            value={emailsText}
            onChange={(e) => setEmailsText(e.target.value)}
            placeholder="teammate@company.com, another@company.com"
            helperText={
              "Separate multiple emails with commas, spaces, or new lines." +
              (validEmails.length > 0 ? ` ${validEmails.length} valid address${validEmails.length > 1 ? "es" : ""} found.` : "")
            }
          />
          {isViewerAdmin && <RoleField role={role} onChange={setRole} hint="Applies to everyone invited at once." />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button type="submit" variant="contained" disabled={isPending || validEmails.length === 0}>
          {validEmails.length > 1 ? `Send ${validEmails.length} invites` : "Send invite"}
        </Button>
      </DialogActions>
    </form>
  );
}

function AddExistingMemberForm({
  projectId,
  members,
  isViewerAdmin,
  onDone,
}: {
  projectId: string;
  members: MemberUser[];
  isViewerAdmin: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState<string>(members[0]?.id ?? "");
  const [role, setRole] = useState<MembershipRole>("MEMBER");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    startTransition(async () => {
      const result = await addExistingMemberToProject({ projectId, userId, role });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const member = members.find((m) => m.id === userId);
      toast.success(`Added ${member?.name ?? "member"} to the project`);
      setRole("MEMBER");
      router.refresh();
      onDone();
    });
  }

  if (members.length === 0) {
    return (
      <DialogContent sx={{ pt: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
          Every company member is already on this project.
        </Typography>
      </DialogContent>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2}>
          <TextField
            select
            label="Company member"
            helperText="Already in the company — this adds them straight to the project, no new email link needed."
            fullWidth
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            {members.map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {m.name} ({m.email})
              </MenuItem>
            ))}
          </TextField>
          {isViewerAdmin && <RoleField role={role} onChange={setRole} hint="Their role on this project." />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button type="submit" variant="contained" disabled={isPending || !userId}>
          Add to project
        </Button>
      </DialogActions>
    </form>
  );
}

export function InviteMemberDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"email" | "existing">("email");
  const close = () => setOpen(false);

  return (
    <>
      <Button variant="contained" size="small" onClick={() => setOpen(true)} startIcon={<UserPlus className="h-4 w-4" />}>
        Invite
      </Button>
      <Dialog open={open} onClose={close} fullWidth maxWidth="xs" aria-label={`Invite to ${props.targetName}`}>
        <DialogTitle>Invite to {props.targetName}</DialogTitle>
        <DialogContent sx={{ pb: 0 }}>
          <DialogContentText>
            {props.target === "project"
              ? "Invite someone new by email, or add an existing company member directly."
              : "They'll each get a one-time sign-in link by email, valid for 12 hours."}
          </DialogContentText>
        </DialogContent>

        {props.target === "project" ? (
          <>
            <Tabs value={tab} onChange={(_, v: "email" | "existing") => setTab(v)} sx={{ px: 3, borderBottom: 1, borderColor: "divider" }}>
              <Tab label="Invite by email" value="email" />
              <Tab label="Add existing member" value="existing" />
            </Tabs>
            {tab === "email" ? (
              <EmailInviteForm target="project" targetId={props.targetId} isViewerAdmin={props.isViewerAdmin} onDone={close} />
            ) : (
              <AddExistingMemberForm
                projectId={props.targetId}
                members={props.addableMembers}
                isViewerAdmin={props.isViewerAdmin}
                onDone={close}
              />
            )}
          </>
        ) : (
          <EmailInviteForm target="company" targetId={props.targetId} isViewerAdmin={props.isViewerAdmin} onDone={close} />
        )}
      </Dialog>
    </>
  );
}
