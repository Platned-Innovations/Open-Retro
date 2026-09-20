import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "neutral" | "subtle" | "danger";
type Size = "lg" | "md" | "sm";

/**
 * Mirrors @platned/ui's Button (`variantStyles`/`sizeStyles` in dist/index.js)
 * so a navigation link can look identical to a real button. Button always
 * renders a native `<button>` and has no polymorphic `render`/`asChild` prop,
 * so there is no way to reuse it for the handful of places that need a styled
 * Next.js `<Link>` rather than an onClick handler.
 *
 * A copy like this normally rots in silence. `tests/linkButton.test.ts` reads
 * the design system's own dist bundle and fails when these no longer agree, so
 * the next `@platned/ui` bump reports the drift instead of quietly shipping two
 * slightly different buttons. `disabled:` classes are deliberately absent —
 * a link cannot be disabled — and the test knows to ignore them.
 *
 * The real fix is an `asChild` prop upstream; until then this is the honest
 * version of the workaround.
 */
export const LINK_BUTTON_VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-brand border border-brand text-brand-on-brand hover:bg-brand-hover",
  neutral: "bg-default border border-default text-default hover:bg-default-hover hover:text-brand",
  subtle: "bg-transparent border border-transparent text-neutral hover:border-default hover:text-brand",
  danger:
    "bg-danger border border-danger-secondary text-danger-on-danger hover:bg-danger-hover hover:border-danger",
};

export const LINK_BUTTON_SIZE_CLASSES: Record<Size, string> = {
  lg: "h-12 px-3 gap-1 rounded-2xl text-body font-semibold [&_svg]:size-5",
  md: "h-9 px-2 gap-0.5 rounded-lg text-body-sm font-semibold [&_svg]:size-5",
  sm: "h-6 px-1.5 pt-0.5 gap-0 rounded-full text-body-tiny font-semibold [&_svg]:size-4",
};

export function LinkButton({
  href,
  variant = "neutral",
  size = "md",
  leadingIcon,
  children,
  className,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  leadingIcon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1",
        LINK_BUTTON_VARIANT_CLASSES[variant],
        LINK_BUTTON_SIZE_CLASSES[size],
        className,
      )}
    >
      {leadingIcon}
      <div className="px-1">{children}</div>
    </Link>
  );
}
