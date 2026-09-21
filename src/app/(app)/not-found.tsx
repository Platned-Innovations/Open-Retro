import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { SearchX } from "lucide-react";
import { NavLinkButton } from "@/components/mui/nav-link";

export default function AppNotFound() {
  return (
    <Stack spacing={1.5} sx={{ minHeight: "60vh", alignItems: "center", justifyContent: "center", px: 2, textAlign: "center" }}>
      <SearchX className="h-10 w-10" style={{ opacity: 0.5 }} />
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        This doesn&apos;t exist anymore
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
        The company, project, or retrospective you were looking for doesn&apos;t exist — it may have been deleted, or the link
        might be out of date.
      </Typography>
      <NavLinkButton href="/" variant="contained" size="small" sx={{ mt: 1 }}>
        Back to dashboard
      </NavLinkButton>
    </Stack>
  );
}
