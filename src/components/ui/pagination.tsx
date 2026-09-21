"use client";

import Link from "next/link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MuiPagination from "@mui/material/Pagination";
import PaginationItem from "@mui/material/PaginationItem";

/**
 * Numbered paging, not just prev/next — MUI's own Pagination pattern, more
 * useful than two arrows once there's more than a couple of pages.
 *
 * A client component now (MUI's Pagination is one), where the plain-link
 * version used to avoid that on purpose. Each page number still renders as a
 * real `<a href>` via `renderItem`, so navigation itself stays a normal page
 * load driven by `searchParams` — only the control's own rendering needs the
 * client bundle now, not the list it's paging through.
 *
 * `params` carries the page's other query values through, so paging doesn't
 * silently drop the filter someone just set.
 */
export function Pagination({
  basePath,
  params,
  pageParam = "page",
  page,
  pageCount,
  label,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  pageParam?: string;
  page: number;
  pageCount: number;
  /** e.g. "retrospectives" — read as "Page 2 of 5 · 84 retrospectives". */
  label: string;
}) {
  if (pageCount <= 1) return null;

  function href(target: number) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && key !== pageParam) query.set(key, value);
    }
    if (target > 1) query.set(pageParam, String(target));
    const search = query.toString();
    return search ? `${basePath}?${search}` : basePath;
  }

  return (
    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }} aria-label={`${label} pages`}>
      <Typography variant="body2" color="text.secondary">
        Page {page} of {pageCount}
      </Typography>
      <MuiPagination
        count={pageCount}
        page={page}
        shape="rounded"
        renderItem={(item) => (
          <PaginationItem
            component={Link}
            href={href(item.page ?? 1)}
            {...item}
          />
        )}
      />
    </Stack>
  );
}
