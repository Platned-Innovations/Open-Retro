"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, ShieldCheck, FolderKanban } from "lucide-react";
import { IconButton } from "@platned/ui";
import { RenameDialog } from "@/components/rename-dialog";
import { ManageUserProjectsDialog } from "@/components/manage-user-projects-dialog";
import { updateUserName, updateUserGlobalRole } from "@/server/actions/users";
import type { GlobalRole } from "@/generated/prisma/client";
import { useAction } from "@/lib/useAction";

type CompanyOption = { id: string; name: string; projects: { id: string; name: string }[] };
type CurrentProject = { id: string; name: string; companyName: string };

type Props = {
  userId: string;
  userName: string;
  role: GlobalRole;
  companies: CompanyOption[];
  currentProjects: CurrentProject[];
};

/**
 * The admin console's row-end actions — rename, promote/demote, and manage
 * project assignments, all Super Admin only. Plain icon buttons rather than
 * a dropdown: the table's own scroll wrapper clips an absolutely-positioned
 * menu, but each button here opens a fixed-position Modal instead, which
 * isn't affected by that.
 */
export function AdminUserActions({ userId, userName, role, companies, currentProjects }: Props) {
  const router = useRouter();
  const { run, isPending } = useAction();
  const [renameOpen, setRenameOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);

  function toggleRole() {
    const nextRole: GlobalRole = role === "SUPER_ADMIN" ? "USER" : "SUPER_ADMIN";
    run(() => updateUserGlobalRole(userId, nextRole), {
      onSuccess: () =>
        toast.success(
          nextRole === "SUPER_ADMIN" ? "Promoted to Super Admin" : "Removed Super Admin",
        ),
    });
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <IconButton aria-label={`Rename ${userName}`} variant="subtle" size="sm" onClick={() => setRenameOpen(true)}>
          <Pencil className="size-3.5" />
        </IconButton>
        <IconButton
          aria-label={role === "SUPER_ADMIN" ? `Remove Super Admin from ${userName}` : `Make ${userName} a Super Admin`}
          variant={role === "SUPER_ADMIN" ? "primary" : "subtle"}
          size="sm"
          disabled={isPending}
          onClick={toggleRole}
        >
          <ShieldCheck className="size-3.5" />
        </IconButton>
        <IconButton
          aria-label={`Manage projects for ${userName}`}
          variant="subtle"
          size="sm"
          onClick={() => setProjectsOpen(true)}
        >
          <FolderKanban className="size-3.5" />
        </IconButton>
      </div>
      {renameOpen && (
        <RenameDialog
          onClose={() => setRenameOpen(false)}
          currentName={userName}
          label={`Rename ${userName}`}
          onSave={async (name) => {
            const result = await updateUserName(userId, name);
            if (!result.ok) {
              toast.error(result.error);
              return false;
            }
            router.refresh();
            return true;
          }}
        />
      )}
      {projectsOpen && (
        <ManageUserProjectsDialog
          onClose={() => setProjectsOpen(false)}
          userId={userId}
          userName={userName}
          companies={companies}
          currentProjects={currentProjects}
        />
      )}
    </>
  );
}
