import { LinkButton } from "@/components/ui/link-button";
import { SearchX } from "lucide-react";

export default function AppNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <SearchX className="h-10 w-10 text-default-secondary" />
      <h1 className="text-heading-sm font-semibold text-default">This doesn&apos;t exist anymore</h1>
      <p className="max-w-sm text-body-sm text-default-secondary">
        The company, project, or retrospective you were looking for doesn&apos;t exist — it may
        have been deleted, or the link might be out of date.
      </p>
      <LinkButton href="/" variant="primary" size="sm" className="mt-2">
        Back to dashboard
      </LinkButton>
    </div>
  );
}
