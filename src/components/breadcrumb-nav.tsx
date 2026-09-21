"use client";

import Link from "next/link";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import MuiLink from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import HomeIcon from "@mui/icons-material/Home";

type Crumb = { label: string; href?: string };

/**
 * Dashboard is always the root; pass the rest of the chain. Last item (no
 * href) renders as current page.
 *
 * A Client Component (MUI's Breadcrumbs is one) even though nothing here is
 * interactive — cheap enough, and it's the one place `component={Link}`
 * would otherwise need a wrapper per call site across five different pages.
 */
export function BreadcrumbNav({ items }: { items: Crumb[] }) {
  return (
    <Breadcrumbs separator="›" sx={{ fontSize: "body2.fontSize" }}>
      <MuiLink component={Link} href="/" color="text.secondary" underline="hover" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
          <HomeIcon sx={{ fontSize: 16 }} />
          Dashboard
        </Stack>
      </MuiLink>
      {items.map((item, i) =>
        item.href ? (
          <MuiLink key={i} component={Link} href={item.href} color="text.secondary" underline="hover">
            {item.label}
          </MuiLink>
        ) : (
          <Typography key={i} variant="body2" color="text.primary" sx={{ fontWeight: 500 }}>
            {item.label}
          </Typography>
        ),
      )}
    </Breadcrumbs>
  );
}
