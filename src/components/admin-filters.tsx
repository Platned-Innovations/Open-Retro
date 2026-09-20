"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select } from "@platned/ui";

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
    <div className="flex flex-wrap gap-3">
      <Select
        className="w-[220px]"
        options={[
          { value: ALL, label: "All companies" },
          ...companies.map((c) => ({ value: c.id, label: c.name })),
        ]}
        value={companyId}
        onChange={(e) => setParam("companyId", e.target.value)}
      />

      <Select
        className="w-[220px]"
        options={[
          { value: ALL, label: "All projects" },
          ...projectOptions.map((p) => ({
            value: p.id,
            label: p.companyName ? `${p.companyName} / ${p.name}` : p.name,
          })),
        ]}
        value={projectId}
        onChange={(e) => setParam("projectId", e.target.value)}
      />
    </div>
  );
}
