"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import {
  Button,
  Textarea,
  Select,
  Tabs,
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from "@platned/ui";
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

const ROLE_OPTIONS = [
  { value: "MEMBER", label: "Member" },
  { value: "ADMIN", label: "Admin" },
];

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
    <Select
      label="Role"
      hint={hint}
      options={ROLE_OPTIONS}
      value={role}
      onChange={(e) => onChange(e.target.value as MembershipRole)}
    />
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
      const succeeded = results.filter(
        (r) => r.status === "fulfilled" && r.value.ok,
      ).length;
      const failed = results
        .map((r, i) => (r.status === "fulfilled" && r.value.ok ? null : validEmails[i]))
        .filter((email): email is string => email !== null);

      const firstError = results.find(
        (r): r is PromiseFulfilledResult<{ ok: false; error: string }> =>
          r.status === "fulfilled" && !r.value.ok,
      )?.value.error;

      if (succeeded > 0) {
        toast.success(succeeded === 1 ? `Invited ${validEmails[0]}` : `Invited ${succeeded} people`);
      }
      if (failed.length > 0) {
        toast.error(
          firstError
            ? `Couldn't invite ${failed.join(", ")}: ${firstError}`
            : `Failed to invite: ${failed.join(", ")}`,
        );
      }
      if (invalidEmails.length > 0) {
        toast.warning(
          `Skipped invalid address${invalidEmails.length > 1 ? "es" : ""}: ${invalidEmails.join(", ")}`,
        );
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
      <div className="flex flex-col gap-4 py-4">
        <Textarea
          label="Emails"
          required
          value={emailsText}
          onChange={(e) => setEmailsText(e.target.value)}
          placeholder="teammate@company.com, another@company.com"
          className="min-h-20"
          hint={
            "Separate multiple emails with commas, spaces, or new lines." +
            (validEmails.length > 0
              ? ` ${validEmails.length} valid address${validEmails.length > 1 ? "es" : ""} found.`
              : "")
          }
        />
        {isViewerAdmin && <RoleField role={role} onChange={setRole} hint="Applies to everyone invited at once." />}
      </div>
      <ModalFooter divider>
        <Button type="submit" disabled={isPending || validEmails.length === 0}>
          {validEmails.length > 1 ? `Send ${validEmails.length} invites` : "Send invite"}
        </Button>
      </ModalFooter>
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
      <p className="py-6 text-center text-body-sm text-default-secondary">
        Every company member is already on this project.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex flex-col gap-4 py-4">
        <Select
          label="Company member"
          hint="Already in the company — this adds them straight to the project, no new email link needed."
          options={members.map((m) => ({ value: m.id, label: `${m.name} (${m.email})` }))}
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        {isViewerAdmin && <RoleField role={role} onChange={setRole} hint="Their role on this project." />}
      </div>
      <ModalFooter divider>
        <Button type="submit" disabled={isPending || !userId}>
          Add to project
        </Button>
      </ModalFooter>
    </form>
  );
}

export function InviteMemberDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"email" | "existing">("email");
  const close = () => setOpen(false);

  return (
    <>
      <Button size="md" onClick={() => setOpen(true)} leadingIcon={<UserPlus className="h-4 w-4" />}>
        Invite
      </Button>
      <Modal isOpen={open} onClose={close} label={`Invite to ${props.targetName}`} size="sm">
        <ModalHeader divider>
          <ModalTitle>Invite to {props.targetName}</ModalTitle>
          <ModalDescription>
            {props.target === "project"
              ? "Invite someone new by email, or add an existing company member directly."
              : "They'll each get a one-time sign-in link by email, valid for 12 hours."}
          </ModalDescription>
        </ModalHeader>

        {props.target === "project" ? (
          <ModalBody>
            <Tabs
              items={[
                { key: "email", label: "Invite by email" },
                { key: "existing", label: "Add existing member" },
              ]}
              value={tab}
              onChange={setTab}
              size="sm"
            />
            {tab === "email" ? (
              <EmailInviteForm
                target="project"
                targetId={props.targetId}
                isViewerAdmin={props.isViewerAdmin}
                onDone={close}
              />
            ) : (
              <AddExistingMemberForm
                projectId={props.targetId}
                members={props.addableMembers}
                isViewerAdmin={props.isViewerAdmin}
                onDone={close}
              />
            )}
          </ModalBody>
        ) : (
          <ModalBody>
            <EmailInviteForm
              target="company"
              targetId={props.targetId}
              isViewerAdmin={props.isViewerAdmin}
              onDone={close}
            />
          </ModalBody>
        )}
      </Modal>
    </>
  );
}
