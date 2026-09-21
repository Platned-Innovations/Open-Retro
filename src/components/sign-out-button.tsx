"use client";

import { signOut } from "next-auth/react";
import Button from "@mui/material/Button";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <Button
      variant="text"
      color="inherit"
      size="small"
      onClick={() => signOut({ callbackUrl: "/login" })}
      startIcon={<LogOut className="h-4 w-4" />}
    >
      Sign out
    </Button>
  );
}
