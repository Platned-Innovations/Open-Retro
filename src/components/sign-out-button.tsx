"use client";

import { signOut } from "next-auth/react";
import { Button } from "@platned/ui";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <Button
      variant="subtle"
      size="md"
      onClick={() => signOut({ callbackUrl: "/login" })}
      leadingIcon={<LogOut className="h-4 w-4" />}
    >
      Sign out
    </Button>
  );
}
