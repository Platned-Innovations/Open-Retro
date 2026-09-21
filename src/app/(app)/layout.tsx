import Image from "next/image";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { NavLinkBox, NavLinkButton } from "@/components/mui/nav-link";
import { colorForUser, textColorOn } from "@/lib/userColor";
import { ListChecks, ShieldCheck } from "lucide-react";
import { countMyOpenActionItems } from "@/server/queries/myActions";
import { version as appVersion } from "../../../package.json";

/**
 * The count is the point: an action item you have to go looking for is one
 * nobody does. Rendered separately so the header isn't held up by the query.
 */
async function MyActionsLink() {
  const open = await countMyOpenActionItems();

  return (
    <NavLinkButton href="/my-actions" color="inherit" size="small" startIcon={<ListChecks className="h-4 w-4" />}>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
        My actions
        {open > 0 && (
          <Chip
            label={open}
            size="small"
            sx={{ bgcolor: "warning.main", color: "warning.contrastText", fontWeight: 700 }}
          />
        )}
      </Stack>
    </NavLinkButton>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user;
  const appName = process.env.APP_NAME ?? "Agile Retro";
  const userAvatarBg = user ? colorForUser(user.id) : null;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", flexDirection: "column" }}>
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: "primary.main",
          color: "primary.contrastText",
          backgroundImage: "linear-gradient(90deg, #0c2d58 0%, #123e73 100%)",
        }}
      >
        <Container maxWidth={false} sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
          <Toolbar disableGutters sx={{ justifyContent: "space-between" }}>
            <NavLinkBox
              href="/"
              sx={{ display: "flex", alignItems: "center", gap: 1, color: "inherit", textDecoration: "none" }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 34,
                  height: 34,
                  borderRadius: "10px",
                  bgcolor: "rgba(255,255,255,0.14)",
                }}
              >
                <Image src="/logo.png" alt={appName} width={22} height={22} />
              </Box>
              <Box sx={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
                  {appName}
                </Typography>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.72)" }}>
                  Powered by Open Retro v{appVersion}
                </Typography>
              </Box>
            </NavLinkBox>

            <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
              {user && <MyActionsLink />}
              {user?.role === "SUPER_ADMIN" && (
                <NavLinkButton
                  href="/admin"
                  color="inherit"
                  size="small"
                  startIcon={<ShieldCheck className="h-4 w-4" />}
                >
                  Admin
                </NavLinkButton>
              )}
              {user && userAvatarBg && (
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Avatar sx={{ width: 28, height: 28, fontSize: 14, bgcolor: userAvatarBg, color: textColorOn(userAvatarBg) }}>
                    {(user.name?.[0] ?? "?").toUpperCase()}
                  </Avatar>
                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)", display: { xs: "none", sm: "inline" } }}>
                    {user.name}
                  </Typography>
                </Stack>
              )}
              <SignOutButton />
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Container
        component="main"
        maxWidth={false}
        sx={{ flex: 1, display: "flex", flexDirection: "column", px: { xs: 2, sm: 3, md: 4 }, py: 4 }}
      >
        {children}
      </Container>
    </Box>
  );
}
