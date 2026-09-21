"use client";

import { useEffect } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { ShieldAlert } from "lucide-react";
import { NavLinkButton } from "@/components/mui/nav-link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Stack spacing={1.5} sx={{ minHeight: "60vh", alignItems: "center", justifyContent: "center", px: 2, textAlign: "center" }}>
      <ShieldAlert className="h-10 w-10" style={{ opacity: 0.5 }} />
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        Couldn&apos;t load this page
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
        This often means you don&apos;t have access to what you were trying to view — you may not be a member of this project,
        company, or retrospective. It could also be a temporary error.
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Button variant="outlined" size="small" onClick={reset}>
          Try again
        </Button>
        <NavLinkButton href="/" variant="contained" size="small">
          Back to dashboard
        </NavLinkButton>
      </Stack>
    </Stack>
  );
}
