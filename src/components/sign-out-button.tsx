"use client";

import { signOut } from "next-auth/react";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const onClick = () => signOut({ callbackUrl: "/login" });

  return (
    <>
      <Box sx={{ display: { xs: "none", sm: "inline-flex" } }}>
        <Button variant="text" color="primary" size="small" onClick={onClick} startIcon={<LogOut className="h-4 w-4" />}>
          Sign out
        </Button>
      </Box>
      <IconButton aria-label="Sign out" onClick={onClick} sx={{ display: { xs: "inline-flex", sm: "none" }, width: 44, height: 44 }}>
        <LogOut className="h-4 w-4" />
      </IconButton>
    </>
  );
}
