"use client";

import Link from "next/link";
import Box, { type BoxProps } from "@mui/material/Box";
import Button, { type ButtonProps } from "@mui/material/Button";
import Chip, { type ChipProps } from "@mui/material/Chip";
import Typography, { type TypographyProps } from "@mui/material/Typography";
import CardActionArea, { type CardActionAreaProps } from "@mui/material/CardActionArea";

/**
 * `component={Link}` hands a raw function reference to a Client Component
 * (every MUI component is one) — fine in a plain client app, but a Server
 * Component can't pass that across the RSC boundary as prop data ("Functions
 * cannot be passed directly to Client Components"). Wrapping it here means
 * `Link` is created and consumed inside client code, never serialized in
 * from a server component that renders these.
 */
export function NavLinkBox(props: BoxProps<typeof Link, { href: string }>) {
  return <Box component={Link} {...props} />;
}

export function NavLinkButton(props: ButtonProps<typeof Link, { href: string }>) {
  return <Button component={Link} {...props} />;
}

export function NavLinkChip(props: ChipProps<typeof Link, { href: string }>) {
  return <Chip component={Link} clickable {...props} />;
}

export function NavLinkText(props: TypographyProps<typeof Link, { href: string }>) {
  return <Typography component={Link} {...props} />;
}

export function NavLinkCardArea(props: CardActionAreaProps<typeof Link, { href: string }>) {
  return <CardActionArea component={Link} {...props} />;
}
