import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Prev/next paging as plain links.
 *
 * Deliberately not a client component: the pages using it are server-rendered
 * from `searchParams`, so paging is a navigation rather than a fetch. That
 * keeps the whole list off the client bundle, which was the point of
 * paginating in the first place.
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

  const linkClass =
    "flex items-center gap-1 rounded-md border border-default px-2.5 py-1.5 text-body-sm text-default transition-colors hover:bg-default-secondary";
  const disabledClass = "pointer-events-none opacity-40";

  return (
    <nav className="flex items-center justify-between gap-3" aria-label={`${label} pages`}>
      <Link
        href={href(page - 1)}
        aria-disabled={page <= 1}
        tabIndex={page <= 1 ? -1 : undefined}
        className={cn(linkClass, page <= 1 && disabledClass)}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Previous
      </Link>

      <span className="text-body-sm text-default-secondary">
        Page {page} of {pageCount}
      </span>

      <Link
        href={href(page + 1)}
        aria-disabled={page >= pageCount}
        tabIndex={page >= pageCount ? -1 : undefined}
        className={cn(linkClass, page >= pageCount && disabledClass)}
      >
        Next
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </nav>
  );
}
