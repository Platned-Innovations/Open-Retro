import Image from "next/image";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Divider from "@mui/material/Divider";
import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { NavLinkBox } from "@/components/mui/nav-link";
import { HeaderNavLink } from "@/components/header-nav-link";
import { colorForUser, textColorOn } from "@/lib/userColor";
import { ds } from "@/lib/design";
import { ListChecks, ShieldCheck } from "lucide-react";
import { countMyOpenActionItems } from "@/server/queries/myActions";
import { version as appVersion } from "../../../package.json";

/** The one content width: header, page and footer all share these edges. */
const WRAP = { width: "100%", maxWidth: 1440, mx: "auto", px: { xs: 2, sm: 3, md: 5 } } as const;

/**
 * The count is the point: an action item you have to go looking for is one
 * nobody does. Rendered separately so the header isn't held up by the query.
 */
async function MyActionsLink() {
  const open = await countMyOpenActionItems();

  return (
    <HeaderNavLink href="/my-actions" icon={<ListChecks />}>
      <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
        My actions
      </Box>
      {open > 0 && (
        <Box
          component="span"
          aria-label={`${open} open`}
          sx={{
            display: "inline-grid",
            placeItems: "center",
            minWidth: 20,
            height: 20,
            px: 0.75,
            borderRadius: 999,
            bgcolor: "secondary.main",
            color: "secondary.contrastText",
            fontFamily: ds.fontMono,
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1,
          }}
        >
          {open}
        </Box>
      )}
    </HeaderNavLink>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user;
  const appName = process.env.APP_NAME ?? "Agile Retro";
  const userAvatarBg = user ? colorForUser(user.id) : null;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", flexDirection: "column" }}>
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          // A number, not `(theme) => theme.zIndex.appBar`: this is a Server
          // Component and a function can't cross into MUI's client Box.
          zIndex: 1100,
          bgcolor: "rgba(255,255,255,0.86)",
          backdropFilter: "saturate(1.4) blur(12px)",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Stack direction="row" sx={{ ...WRAP, height: 64, alignItems: "center", justifyContent: "space-between", gap: 2 }}>
          <NavLinkBox
            href="/"
            aria-label={`${appName} home`}
            sx={{ display: "flex", alignItems: "center", gap: 1.25, color: "inherit", textDecoration: "none", minWidth: 0 }}
          >
            <Image src="/logo.png" alt="" width={28} height={28} priority />
            <Typography component="span" sx={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
              {appName}
            </Typography>
          </NavLinkBox>

          <Stack direction="row" spacing={{ xs: 0.25, sm: 0.5 }} sx={{ alignItems: "center", minWidth: 0 }}>
            {user && <MyActionsLink />}
            {user?.role === "SUPER_ADMIN" && (
              <HeaderNavLink href="/admin" icon={<ShieldCheck />}>
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                  Admin
                </Box>
              </HeaderNavLink>
            )}
            {user && (
              <Divider orientation="vertical" flexItem sx={{ mx: { xs: 0.5, sm: 1.5 }, my: 2.25 }} />
            )}
            {user && userAvatarBg && (
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", pr: { xs: 0, sm: 0.5 } }}>
                <Avatar sx={{ width: 28, height: 28, fontSize: 13, bgcolor: userAvatarBg, color: textColorOn(userAvatarBg) }}>
                  {(user.name?.[0] ?? "?").toUpperCase()}
                </Avatar>
                <Typography variant="body2" sx={{ fontWeight: 500, display: { xs: "none", md: "inline" }, whiteSpace: "nowrap" }}>
                  {user.name}
                </Typography>
              </Stack>
            )}
            <SignOutButton />
          </Stack>
        </Stack>
      </Box>

      <Box
        component="main"
        id="main"
        sx={{ ...WRAP, flex: 1, minWidth: 0, display: "flex", flexDirection: "column", pt: { xs: 3, md: 5 }, pb: { xs: 6, md: 8 } }}
      >
        {children}
      </Box>

      <Box component="footer" sx={{ borderTop: 1, borderColor: "divider" }}>
        <Stack
          direction="row"
          sx={{ ...WRAP, py: 2.5, justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}
        >
          <Typography variant="caption" color="text.secondary">
            {appName}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: ds.fontMono }}>
            Open Retro v{appVersion}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}
