"use client";

import { useEffect } from "react";
import { Button } from "@platned/ui";
import { LinkButton } from "@/components/ui/link-button";
import { ShieldAlert } from "lucide-react";

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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <ShieldAlert className="h-10 w-10 text-default-secondary" />
      <h1 className="text-heading-sm font-semibold text-default">Couldn&apos;t load this page</h1>
      <p className="max-w-sm text-body-sm text-default-secondary">
        This often means you don&apos;t have access to what you were trying to view — you may not
        be a member of this project, company, or retrospective. It could also be a temporary
        error.
      </p>
      <div className="mt-2 flex gap-2">
        <Button variant="neutral" size="sm" onClick={reset}>
          Try again
        </Button>
        <LinkButton href="/" variant="primary" size="sm">
          Back to dashboard
        </LinkButton>
      </div>
    </div>
  );
}
