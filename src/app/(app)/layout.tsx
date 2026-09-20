import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { LinkButton } from "@/components/ui/link-button";
import { Avatar, CountBadge } from "@platned/ui";
import { ListChecks, ShieldCheck } from "lucide-react";
import { countMyOpenActionItems } from "@/server/queries/myActions";

/**
 * The count is the point: an action item you have to go looking for is one
 * nobody does. Rendered separately so the header isn't held up by the query.
 */
async function MyActionsLink() {
  const open = await countMyOpenActionItems();

  return (
    <LinkButton href="/my-actions" variant="subtle" size="md" leadingIcon={<ListChecks className="h-4 w-4" />}>
      <span className="flex items-center gap-1.5">
        My actions
        {open > 0 && <CountBadge count={open} tone="warning" />}
      </span>
    </LinkButton>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-default bg-default">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 text-body font-semibold text-default">
            <Image src="/logo.png" alt="Agile Retro" width={28} height={28} />
            Agile Retro
          </Link>

          <nav className="flex items-center gap-4">
            {user && <MyActionsLink />}
            {user?.role === "SUPER_ADMIN" && (
              <LinkButton href="/admin" variant="subtle" size="md" leadingIcon={<ShieldCheck className="h-4 w-4" />}>
                Admin
              </LinkButton>
            )}
            {user && (
              <div className="flex items-center gap-2">
                <Avatar type="initial" initial={(user.name?.[0] ?? "?").toUpperCase()} size="sm" />
                <span className="hidden text-body-sm text-default-secondary sm:inline">{user.name}</span>
              </div>
            )}
            <SignOutButton />
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8">{children}</main>
    </div>
  );
}
