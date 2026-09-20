"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Card, CardBody, Input, IconButton, Select } from "@platned/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
export function MembersPanel({
  scope,
  scopeId,
  memberships,
  currentUserId,
  isViewerAdmin,
  adminCount,
}: Props) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>(ALL);
  const [projectFilter, setProjectFilter] = useState<string>(ALL);

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
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          size="sm"
          placeholder="Search members"
          aria-label="Search members"
          leadingIcon={<Search className="size-4" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        {/* Base UI's Popover rather than a hand-rolled absolute div: it brings
            the dialog role, focus management, Esc-to-close and collision
            detection that the hand-rolled one had none of. */}
        <Popover>
          <PopoverTrigger
            render={
              <IconButton
                aria-label="Filter members"
                variant={hasActiveFilters ? "primary" : "neutral"}
                size="sm"
              />
            }
          >
            <SlidersHorizontal className="size-4" />
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="end">
            <div className="flex flex-col gap-3">
              <Select
                label="Role"
                size="sm"
                options={[
                  { value: ALL, label: "All roles" },
                  { value: "ADMIN", label: "Admin" },
                  { value: "MEMBER", label: "Member" },
                ]}
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              />
              {projectOptions.length > 0 && (
                <Select
                  label="Project"
                  size="sm"
                  options={[
                    { value: ALL, label: "All projects" },
                    ...projectOptions.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                />
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* overflow-visible: MemberRow's action menu is absolutely positioned and would
          otherwise be clipped by Card's default overflow-hidden. */}
      <Card className="overflow-visible">
        <CardBody size="sm" className="flex max-h-[420px] flex-col gap-0 divide-y divide-divider overflow-y-auto overflow-x-hidden p-0">
          {filtered.length === 0 ? (
            <p className="p-4 text-body-sm text-default-secondary">No members match.</p>
          ) : (
            filtered.map((m) => (
              <MemberRow
                key={m.id}
                scope={scope}
                scopeId={scopeId}
                membership={m}
                currentUserId={currentUserId}
                isViewerAdmin={isViewerAdmin}
                adminCount={adminCount}
              />
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}
