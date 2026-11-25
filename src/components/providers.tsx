"use client";

import { SessionProvider } from "next-auth/react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { theme } from "@/lib/mui-theme";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider>
      {/* "system" until someone picks: follows the OS, and keeps following it. */}
      <ThemeProvider theme={theme} defaultMode="system" disableTransitionOnChange>
        <CssBaseline />
        <SessionProvider>
          {children}
          <Toaster richColors position="top-right" />
        </SessionProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
