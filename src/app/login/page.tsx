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
import { MailCheck } from "lucide-react";

import { requestLoginLink } from "@/server/actions/auth";
import { ds } from "@/lib/design";

const APP_NAME = "Agile Retro";

/**
 * A still of the product itself, built in HTML rather than a screenshot: the
 * three columns of a Start / Stop / Continue board mid-discussion, with the
 * card the group is on marked the way the real board marks it.
 */
function BoardFragment() {
  const columns = [
    {
      title: "Start",
      color: "#1baf7a",
      cards: [
        { text: "Pair on the release checklist", votes: 4, focus: true },
        { text: "Demo to support every Friday", votes: 2 },
      ],
    },
    {
      title: "Stop",
      color: "#e34948",
      cards: [{ text: "Merging after 5pm", votes: 3 }],
    },
    {
      title: "Continue",
      color: "#2a78d6",
      cards: [
        { text: "Short stand-ups", votes: 1 },
        { text: "Writing the why in PRs", votes: 2 },
      ],
    },
  ];

  return (
    <Box
      role="img"
      aria-label="A retrospective board with Start, Stop and Continue columns, one card highlighted for discussion"
      sx={{
        bgcolor: ds.invSurface,
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: `${ds.r.lg}px`,
        p: 1.5,
        boxShadow: "0 40px 80px -40px rgba(0,0,0,0.6)",
      }}
    >
      <Stack direction="row" sx={{ alignItems: "center", gap: 1, px: 0.5, pb: 1.5 }}>
        {[0, 1, 2].map((i) => (
          <Box key={i} sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.16)" }} />
        ))}
        <Typography sx={{ ml: 1, fontFamily: ds.fontMono, fontSize: 11.5, color: ds.invMuted }}>
          Sprint 42 · Discuss
        </Typography>
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1 }}>
        {columns.map((col) => (
          <Stack key={col.title} spacing={1} sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", px: 0.5 }}>
              <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: col.color }} />
              <Typography sx={{ fontSize: 12, fontWeight: 500, color: ds.invInk }}>{col.title}</Typography>
            </Stack>
            {col.cards.map((card) => (
              <Box
                key={card.text}
                sx={{
                  bgcolor: "#fff",
                  color: ds.ink,
                  borderRadius: `${ds.r.sm}px`,
                  p: 1,
                  fontSize: 12,
                  lineHeight: 1.35,
                  outline: card.focus ? `2px solid ${ds.accent}` : "none",
                  outlineOffset: 2,
                }}
              >
                {card.text}
                <Stack direction="row" spacing={0.5} sx={{ mt: 0.75, alignItems: "center" }}>
                  {Array.from({ length: card.votes }, (_, i) => (
                    <Box key={i} sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: ds.ink }} />
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        ))}
      </Box>
    </Box>
  );
}

function BrandPanel() {
  const points = [
    "A guided session, one step at a time",
    "Real anonymity where it matters",
    "Action items that survive the meeting",
  ];

  return (
    <Box
      sx={{
        display: { xs: "none", md: "flex" },
        flexDirection: "column",
        justifyContent: "space-between",
        width: { md: "52%", lg: "56%" },
        flexShrink: 0,
        bgcolor: ds.invBg,
        color: ds.invInk,
        p: { md: 6, lg: 8 },
        gap: 6,
        overflow: "hidden",
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }} className="enter">
        <Image src="/logo.png" alt="" width={32} height={32} priority />
        <Typography sx={{ fontSize: 18, fontWeight: 500, letterSpacing: "-0.02em" }}>{APP_NAME}</Typography>
      </Stack>

      <Box sx={{ maxWidth: 620 }}>
        <Typography
          component="p"
          variant="h2"
          className="enter enter-2"
          sx={{ color: ds.invInk, letterSpacing: "-0.04em", lineHeight: 1.04 }}
        >
          Retrospectives that run the meeting, not just store what came out of it.
        </Typography>
        <Stack component="ul" spacing={1.25} className="enter enter-3" sx={{ mt: 4, p: 0, listStyle: "none" }}>
          {points.map((point, i) => (
            <Stack component="li" key={point} direction="row" spacing={1.5} sx={{ alignItems: "baseline" }}>
              <Typography component="span" sx={{ fontFamily: ds.fontMono, fontSize: 12.5, color: ds.accent }}>
                0{i + 1}
              </Typography>
              <Typography component="span" sx={{ fontSize: 16, color: "rgba(255,255,255,0.86)" }}>
                {point}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Box>

      <Box className="enter enter-4" sx={{ maxWidth: 560 }}>
        <BoardFragment />
      </Box>
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
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <BrandPanel />

      <Box
        component="main"
        sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", px: { xs: 2, sm: 4 }, py: 6 }}
      >
        <Box sx={{ width: "100%", maxWidth: 380 }} className="enter enter-2">
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mb: 5, display: { md: "none" } }}>
            <Image src="/logo.png" alt="" width={28} height={28} priority />
            <Typography sx={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.02em" }}>{APP_NAME}</Typography>
          </Stack>

          <Typography variant="h3" component="h1">
            Welcome back
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1, mb: 4 }}>
            Sign in to your team&apos;s workspace.
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
              <Stack
                spacing={1.5}
                sx={{ p: 2.5, borderRadius: `${ds.r.md}px`, bgcolor: ds.surface, border: 1, borderColor: "divider" }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "secondary.main",
                    color: "secondary.contrastText",
                  }}
                >
                  <MailCheck className="h-4 w-4" />
                </Box>
                <Typography variant="body2">
                  If <strong>{linkEmail}</strong> is registered, a sign-in link is on its way. It&apos;s valid for 12
                  hours.
                </Typography>
              </Stack>
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
                <Typography variant="caption" color="text.secondary">
                  No password needed. The link signs you in for 12 hours.
                </Typography>
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
