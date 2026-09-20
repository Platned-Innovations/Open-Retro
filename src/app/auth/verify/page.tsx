"use client";

import { useEffect, useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function VerifyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<"pending" | "error">(token ? "pending" : "error");

  // Same-origin, single-leading-slash paths only — mirrors the check the
  // server already applies before embedding this in the emailed link, done
  // again here since it's just a URL param anyone could edit by hand.
  const callback = params.get("callbackUrl");
  const destination = callback && callback.startsWith("/") && !callback.startsWith("//") ? callback : "/";

  useEffect(() => {
    if (!token) return;

    signIn("login-token", { token, redirect: false }).then((result) => {
      if (result?.error) {
        setStatus("error");
      } else {
        router.push(destination);
      }
    });
  }, [token, router, destination]);

  if (status === "error") {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-2 p-4 text-center">
        <p className="text-body-lg font-semibold text-default">This link is invalid or has expired.</p>
        <p className="text-body-sm text-default-secondary">
          Login links are single-use and expire after 12 hours. Request a new one from the
          sign-in page.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-2">
      <Loader2 className="h-6 w-6 animate-spin text-default-secondary" />
      <p className="text-body-sm text-default-secondary">Signing you in…</p>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyInner />
    </Suspense>
  );
}
