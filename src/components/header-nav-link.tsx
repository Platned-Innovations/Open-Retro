"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";

/**
 * A header link. Its underline draws on hover (`.nav-link` in globals.css)
 * and stays drawn on the page you're on, which needs the pathname — hence a
 * Client Component of its own rather than the whole header.
 */
export function HeaderNavLink({ href, icon, children }: { href: string; icon?: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const current = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Box
      component={Link}
      href={href}
      className="nav-link"
      aria-current={current ? "page" : undefined}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        height: 40,
        px: 1.25,
        borderRadius: 1,
        fontSize: 14.5,
        fontWeight: 500,
        color: current ? "text.primary" : "text.secondary",
        textDecoration: "none",
        whiteSpace: "nowrap",
        transition: "color 180ms cubic-bezier(.2,.8,.2,1)",
        "&:hover": { color: "text.primary" },
        "& svg": { width: 16, height: 16, flexShrink: 0 },
      }}
    >
      {icon}
      {children}
    </Box>
  );
}
