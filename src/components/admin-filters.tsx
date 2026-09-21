"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";

type CompanyOption = { id: string; name: string; projects: { id: string; name: string }[] };

const ALL = "__all__";

export function AdminFilters({ companies }: { companies: CompanyOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const companyId = searchParams.get("companyId") ?? ALL;
  const projectId = searchParams.get("projectId") ?? ALL;

  const projectOptions =
    companyId === ALL
      ? companies.flatMap((c) => c.projects.map((p) => ({ ...p, companyName: c.name })))
      : (companies.find((c) => c.id === companyId)?.projects ?? []).map((p) => ({
          ...p,
          companyName: "",
        }));

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === ALL) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    // Changing company invalidates any project filter from a different company.
    if (key === "companyId") params.delete("projectId");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }}>
      <TextField
        select
        size="small"
        label="Company"
        sx={{ width: 220 }}
        value={companyId}
        onChange={(e) => setParam("companyId", e.target.value)}
      >
        <MenuItem value={ALL}>All companies</MenuItem>
        {companies.map((c) => (
          <MenuItem key={c.id} value={c.id}>
            {c.name}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        size="small"
        label="Project"
        sx={{ width: 220 }}
        value={projectId}
        onChange={(e) => setParam("projectId", e.target.value)}
      >
        <MenuItem value={ALL}>All projects</MenuItem>
        {projectOptions.map((p) => (
          <MenuItem key={p.id} value={p.id}>
            {p.companyName ? `${p.companyName} / ${p.name}` : p.name}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}
