"use client";

import { useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreVert } from "@mui/icons-material";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import { RenameDialog } from "@/components/rename-dialog";
import { colorForUser, textColorOn } from "@/lib/userColor";
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

type MenuAction = {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
};

/** One row in a project's or company's member list, with the role/remove actions its viewer is allowed to take. */
export function MemberRow({ scope, scopeId, membership, currentUserId, isViewerAdmin, adminCount }: Props) {
  const router = useRouter();
  const { run, isPending } = useAction();
  const [renameOpen, setRenameOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const avatarBg = colorForUser(membership.user.id);
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
    run(() => (scope === "project" ? removeProjectMember(scopeId, membership.user.id) : removeCompanyMember(scopeId, membership.user.id)), {
      onSuccess: () => toast.success(`Removed ${membership.user.name}`),
    });
  }

  const items: MenuAction[] = [];
  if (canRename) {
    items.push({ label: "Rename", onSelect: () => setRenameOpen(true), disabled: isPending });
  }
  if (canChangeRole) {
    items.push({
      label: membership.role === "ADMIN" ? "Make member" : "Make admin",
      onSelect: toggleRole,
      disabled: isPending,
    });
  }
  if (canRemove) {
    items.push({
      label: `Remove from ${scope}`,
      onSelect: remove,
      danger: true,
      disabled: isPending,
      separatorBefore: canChangeRole || canRename,
    });
  }
  if (showLastAdminNote) {
    items.push({ label: "Only admin — promote someone else first", onSelect: () => {}, disabled: true });
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, p: 1.5 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
        <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: avatarBg, color: textColorOn(avatarBg) }}>
          {membership.user.name.slice(0, 1).toUpperCase()}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
            {membership.user.name}
            {isSelf && <Typography component="span" variant="body2" color="text.secondary"> (you)</Typography>}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
            {membership.user.email}
          </Typography>
        </Box>
      </Stack>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexShrink: 0 }}>
        <Chip label={membership.role === "ADMIN" ? "Admin" : "Member"} size="small" color={membership.role === "ADMIN" ? "primary" : "default"} />
        {hasAnyAction && (
          <>
            <IconButton
              aria-label={`Open actions for ${membership.user.name}`}
              size="small"
              onClick={(e: MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)}
            >
              <MoreVert fontSize="small" />
            </IconButton>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
              {items.map((item, i) => [
                item.separatorBefore && <Divider key={`${i}-divider`} />,
                <MenuItem
                  key={i}
                  disabled={item.disabled}
                  onClick={() => {
                    setAnchorEl(null);
                    item.onSelect();
                  }}
                  sx={item.danger ? { color: "error.main" } : undefined}
                >
                  {item.label}
                </MenuItem>,
              ])}
            </Menu>
          </>
        )}
      </Stack>
      {renameOpen && (
        <RenameDialog
          onClose={() => setRenameOpen(false)}
          currentName={membership.user.name}
          label={isSelf ? "Rename yourself" : `Rename ${membership.user.name}`}
          onSave={rename}
        />
      )}
    </Box>
  );
}
