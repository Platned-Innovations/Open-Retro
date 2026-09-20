"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreVertical } from "lucide-react";
import { Avatar, RoleBadge, DropdownMenu, type DropdownMenuItem } from "@platned/ui";
import { RenameDialog } from "@/components/rename-dialog";
import {
  removeProjectMember,
  updateProjectMemberRole,
  removeCompanyMember,
  updateCompanyMemberRole,
  updateProjectMemberName,
  updateCompanyMemberName,
} from "@/server/actions/invitations";
import type { MembershipRole } from "@/generated/prisma/client";
import type { MemberUser } from "@/types/member";
import { useAction } from "@/lib/useAction";

type Membership = { id: string; role: MembershipRole; user: MemberUser };

type Props = {
  scope: "project" | "company";
  scopeId: string;
  membership: Membership;
  currentUserId: string;
  isViewerAdmin: boolean;
  /** Total number of ADMIN members in this project/company — used to block removing the last one. */
  adminCount: number;
};

/** One row in a project's or company's member list, with the role/remove actions its viewer is allowed to take. */
export function MemberRow({
  scope,
  scopeId,
  membership,
  currentUserId,
  isViewerAdmin,
  adminCount,
}: Props) {
  const router = useRouter();
  const { run, isPending } = useAction();
  const [renameOpen, setRenameOpen] = useState(false);

  const isSelf = membership.user.id === currentUserId;
  const targetIsAdmin = membership.role === "ADMIN";
  const isLastAdmin = targetIsAdmin && adminCount <= 1;

  // Only admins can change roles at all. A plain member can remove another
  // plain member, but never an admin, and never themselves. Nobody — not
  // even another admin — can demote or remove the only admin left; that's
  // how a project/company ends up with no admin and no way to recover.
  const canChangeRole = isViewerAdmin && !isLastAdmin;
  const canRemove = (isViewerAdmin || (!targetIsAdmin && !isSelf)) && !isLastAdmin;
  // Anyone may rename themselves; an admin may rename anyone else in this list.
  const canRename = isSelf || isViewerAdmin;
  const showLastAdminNote = isViewerAdmin && isLastAdmin;
  const hasAnyAction = canChangeRole || canRemove || canRename || showLastAdminNote;

  // Awaited rather than routed through `run`, because RenameDialog closes on
  // the promise resolving. It has to check `ok` explicitly: this used to rely
  // on a throw to skip the success toast, so with a result shape a refused
  // rename would have reported "Name updated".
  async function rename(name: string) {
    const result =
      scope === "project"
        ? await updateProjectMemberName(scopeId, membership.user.id, name)
        : await updateCompanyMemberName(scopeId, membership.user.id, name);

    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success("Name updated");
    router.refresh();
    return true;
  }

  function toggleRole() {
    const nextRole: MembershipRole = membership.role === "ADMIN" ? "MEMBER" : "ADMIN";
    run(() =>
      scope === "project"
        ? updateProjectMemberRole(scopeId, membership.user.id, nextRole)
        : updateCompanyMemberRole(scopeId, membership.user.id, nextRole),
    );
  }

  function remove() {
    run(
      () =>
        scope === "project"
          ? removeProjectMember(scopeId, membership.user.id)
          : removeCompanyMember(scopeId, membership.user.id),
      { onSuccess: () => toast.success(`Removed ${membership.user.name}`) },
    );
  }

  const items: DropdownMenuItem[] = [];
  if (canRename) {
    items.push({ label: "Rename", onSelect: () => setRenameOpen(true), disabled: isPending });
  }
  if (canChangeRole) {
    items.push({ label: membership.role === "ADMIN" ? "Make member" : "Make admin", onSelect: toggleRole, disabled: isPending });
  }
  if (canRemove) {
    items.push({
      label: `Remove from ${scope}`,
      onSelect: remove,
      tone: "danger",
      disabled: isPending,
      separatorBefore: canChangeRole || canRename,
    });
  }
  if (showLastAdminNote) {
    items.push({ label: "Only admin — promote someone else first", onSelect: () => {}, disabled: true });
  }

  return (
    <div className="flex items-center justify-between gap-3 p-3">
      <div className="flex min-w-0 items-center gap-2">
        <Avatar type="initial" initial={membership.user.name.slice(0, 1).toUpperCase()} size="sm" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-body-sm font-medium text-default">
            {membership.user.name}
            {isSelf && <span className="text-default-secondary"> (you)</span>}
          </span>
          <span className="truncate text-body-tiny text-default-secondary">{membership.user.email}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <RoleBadge role={membership.role === "ADMIN" ? "Admin" : "Member"} size="sm" />
        {hasAnyAction && (
          <DropdownMenu
            items={items}
            label={`Open actions for ${membership.user.name}`}
            align="right"
            trigger={<MoreVertical className="size-4" />}
          />
        )}
      </div>
      {renameOpen && (
        <RenameDialog
          onClose={() => setRenameOpen(false)}
          currentName={membership.user.name}
          label={isSelf ? "Rename yourself" : `Rename ${membership.user.name}`}
          onSave={rename}
        />
      )}
    </div>
  );
}
