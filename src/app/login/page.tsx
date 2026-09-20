"use client";

import { useState, useTransition, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button, Input, Tabs, Card, CardHeader, CardTitle, CardDescription, CardBody } from "@platned/ui";
import { requestLoginLink } from "@/server/actions/auth";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";

  const [tab, setTab] = useState<"link" | "password">("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [linkEmail, setLinkEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await signIn("password", { email, password, redirect: false });
      if (result?.error) {
        toast.error("Invalid email or password.");
        return;
      }
      router.push(callbackUrl);
    });
  }

  async function handleRequestLink(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await requestLoginLink(linkEmail, callbackUrl);
      setLinkSent(true);
    });
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle size="lg">Sign in to Agile Retro</CardTitle>
          <CardDescription>Retrospectives for your whole company.</CardDescription>
        </CardHeader>
        <CardBody>
          <Tabs
            items={[
              { key: "link", label: "Email me a link" },
              { key: "password", label: "Super Admin" },
            ]}
            value={tab}
            onChange={setTab}
            className="mb-4"
          />

          {tab === "link" ? (
            linkSent ? (
              <p className="text-body-sm text-default-secondary">
                If <strong>{linkEmail}</strong> is registered, a sign-in link is on its way.
                It&apos;s valid for 12 hours.
              </p>
            ) : (
              <form onSubmit={handleRequestLink} className="flex flex-col gap-4">
                <Input
                  label="Work email"
                  type="email"
                  required
                  value={linkEmail}
                  onChange={(e) => setLinkEmail(e.target.value)}
                  placeholder="you@company.com"
                />
                <Button type="submit" className="w-full" disabled={isPending}>
                  Send login link
                </Button>
              </form>
            )
          ) : (
            <form onSubmit={handlePasswordSignIn} className="flex flex-col gap-4">
              <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input
                label="Password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" className="w-full" disabled={isPending}>
                Sign in
              </Button>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
