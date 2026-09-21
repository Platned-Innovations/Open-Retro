"use client";

import { useState, useTransition, Suspense } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

import { requestLoginLink } from "@/server/actions/auth";

function BrandPanel() {
  return (
    <Box
      sx={{
        display: { xs: "none", md: "flex" },
        flexDirection: "column",
        justifyContent: "center",
        width: 440,
        flexShrink: 0,
        bgcolor: "primary.main",
        color: "primary.contrastText",
        p: 6,
      }}
    >
      <Image src="/logo.png" alt="" width={40} height={40} />
      <Typography variant="h3" sx={{ mt: 3, fontWeight: 700 }}>
        Agile Retro
      </Typography>
      <Typography variant="h6" sx={{ mt: 2, opacity: 0.85, fontWeight: 400 }}>
        Retrospectives that run the meeting, not just store what came out of it.
      </Typography>
      <Stack spacing={1.5} sx={{ mt: 5, opacity: 0.9 }}>
        <Typography variant="body2">A guided session, one step at a time</Typography>
        <Typography variant="body2">Real anonymity where it matters</Typography>
        <Typography variant="body2">Action items that survive the meeting</Typography>
      </Stack>
    </Box>
  );
}

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
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <BrandPanel />

      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", p: 3 }}>
        <Box sx={{ width: "100%", maxWidth: 360 }}>
          <Typography
            variant="h4"
            sx={{ fontWeight: 700, display: { md: "none" } }}
          >
            Agile Retro
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mt: { xs: 1, md: 0 } }}>
            Welcome back
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, mb: 4 }}>
            Sign in to your workspace.
          </Typography>

          <Tabs
            value={tab}
            onChange={(_, value: "link" | "password") => setTab(value)}
            variant="fullWidth"
            sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
          >
            <Tab label="Email link" value="link" />
            <Tab label="Super Admin" value="password" />
          </Tabs>

          {tab === "link" ? (
            linkSent ? (
              <Typography variant="body2" color="text.secondary">
                If <strong>{linkEmail}</strong> is registered, a sign-in link is on its way. It&apos;s valid for 12
                hours.
              </Typography>
            ) : (
              <Stack component="form" onSubmit={handleRequestLink} spacing={2.5}>
                <TextField
                  label="Work email"
                  type="email"
                  required
                  fullWidth
                  value={linkEmail}
                  onChange={(e) => setLinkEmail(e.target.value)}
                  placeholder="you@company.com"
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={isPending}
                  startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
                >
                  Send login link
                </Button>
              </Stack>
            )
          ) : (
            <Stack component="form" onSubmit={handlePasswordSignIn} spacing={2.5}>
              <TextField
                label="Email"
                type="email"
                required
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <TextField
                label="Password"
                type="password"
                required
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={isPending}
                startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                Sign in
              </Button>
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
