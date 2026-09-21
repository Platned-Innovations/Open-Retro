"use client";

import { useEffect, useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Stack from "@mui/material/Stack";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";

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
      <Stack spacing={1} sx={{ minHeight: "80vh", alignItems: "center", justifyContent: "center", p: 2, textAlign: "center" }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          This link is invalid or has expired.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Login links are single-use and expire after 12 hours. Request a new one from the sign-in page.
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={1.5} sx={{ minHeight: "80vh", alignItems: "center", justifyContent: "center" }}>
      <CircularProgress size={24} />
      <Typography variant="body2" color="text.secondary">
        Signing you in…
      </Typography>
    </Stack>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyInner />
    </Suspense>
  );
}
