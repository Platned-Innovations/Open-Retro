"use client";

import { useMemo, useState, type MouseEvent } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Box from "@mui/material/Box";
import { MemberRow } from "@/components/member-row";
import type { MembershipRole } from "@/generated/prisma/client";
import type { MemberUser } from "@/types/member";

type ProjectOption = { id: string; name: string };

type Membership = {
  id: string;
  role: MembershipRole;
  user: MemberUser;
  /** Projects this member belongs to within the company. Only present for scope="company". */
  projects?: ProjectOption[];
};

type Props = {
  scope: "project" | "company";
  scopeId: string;
  memberships: Membership[];
  currentUserId: string;
  isViewerAdmin: boolean;
  adminCount: number;
};

const ALL = "__all__";

/** Search box + role/project filter above a scrollable member list, so a long roster doesn't push the rest of the page down. */
export function MembersPanel({ scope, scopeId, memberships, currentUserId, isViewerAdmin, adminCount }: Props) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>(ALL);
  const [projectFilter, setProjectFilter] = useState<string>(ALL);
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);

  const projectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of memberships) for (const p of m.projects ?? []) seen.set(p.id, p.name);
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [memberships]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return memberships.filter((m) => {
      if (q && !m.user.name.toLowerCase().includes(q) && !m.user.email.toLowerCase().includes(q)) return false;
      if (roleFilter !== ALL && m.role !== roleFilter) return false;
      if (projectFilter !== ALL && !(m.projects ?? []).some((p) => p.id === projectFilter)) return false;
      return true;
    });
  }, [memberships, search, roleFilter, projectFilter]);

  const hasActiveFilters = roleFilter !== ALL || projectFilter !== ALL;

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <TextField
          size="small"
          placeholder="Search members"
          aria-label="Search members"
          fullWidth
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search className="size-4" />
                </InputAdornment>
              ),
            },
          }}
        />
        <IconButton
          aria-label="Filter members"
          size="small"
          color={hasActiveFilters ? "primary" : "default"}
          onClick={(e: MouseEvent<HTMLElement>) => setFilterAnchor(e.currentTarget)}
        >
          <SlidersHorizontal className="size-4" />
        </IconButton>
        <Popover
          open={Boolean(filterAnchor)}
          anchorEl={filterAnchor}
          onClose={() => setFilterAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <Stack spacing={2} sx={{ p: 2, width: 224 }}>
            <TextField select size="small" label="Role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <MenuItem value={ALL}>All roles</MenuItem>
              <MenuItem value="ADMIN">Admin</MenuItem>
              <MenuItem value="MEMBER">Member</MenuItem>
            </TextField>
            {projectOptions.length > 0 && (
              <TextField select size="small" label="Project" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                <MenuItem value={ALL}>All projects</MenuItem>
                {projectOptions.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>
        </Popover>
      </Stack>

      <Paper variant="outlined" sx={{ maxHeight: 420, overflowY: "auto", overflowX: "hidden" }}>
        {filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No members match.
          </Typography>
        ) : (
          filtered.map((m, i) => (
            <Box key={m.id} sx={i > 0 ? { borderTop: 1, borderColor: "divider" } : undefined}>
              <MemberRow
                scope={scope}
                scopeId={scopeId}
                membership={m}
                currentUserId={currentUserId}
                isViewerAdmin={isViewerAdmin}
                adminCount={adminCount}
              />
            </Box>
          ))
        )}
      </Paper>
    </Stack>
  );
}
