import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

type Crumb = { label: string; href?: string };

/** Dashboard is always the root; pass the rest of the chain. Last item (no href) renders as current page. */
export function BreadcrumbNav({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-body-sm text-default-secondary">
      <Link href="/" className="flex items-center gap-1 hover:text-brand hover:underline">
        <Home className="h-3.5 w-3.5" />
        Dashboard
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5" />
          {item.href ? (
            <Link href={item.href} className="hover:text-brand hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-default">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
