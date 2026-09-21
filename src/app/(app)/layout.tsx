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
        {open > 0 && <Chip label={open} color="warning" size="small" />}
      </Stack>
    </NavLinkButton>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user;
  const appName = process.env.APP_NAME ?? "Agile Retro";

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", flexDirection: "column" }}>
      <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Container maxWidth={false} sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
          <Toolbar disableGutters sx={{ justifyContent: "space-between" }}>
            <NavLinkBox
              href="/"
              sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.primary", textDecoration: "none" }}
            >
              <Image src="/logo.png" alt={appName} width={28} height={28} />
              <Box sx={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
                  {appName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
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
              {user && (
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Avatar sx={{ width: 28, height: 28, fontSize: 14 }}>
                    {(user.name?.[0] ?? "?").toUpperCase()}
                  </Avatar>
                  <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "inline" } }}>
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
