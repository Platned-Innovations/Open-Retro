import type { Metadata } from "next";
import { Chivo, Chivo_Mono } from "next/font/google";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import "./globals.css";
import { Providers } from "@/components/providers";

// tasteskill's dealt pairing for a software product: a neo-grotesk for both
// headings and text, with its own mono for counts, codes and labels.
const chivo = Chivo({
  variable: "--font-chivo",
  subsets: ["latin"],
  display: "swap",
});

const chivoMono = Chivo_Mono({
  variable: "--font-chivo-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Agile Retro",
  description: "Retrospectives for your team, from company down to project.",
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // InitColorSchemeScript adds the `light` / `dark` class before React
      // loads, so the server's <html> and the browser's differ on purpose.
      suppressHydrationWarning
      className={`${chivo.variable} ${chivoMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Sets the mode class on <html> before first paint: no white flash
            on a dark page. Must match the theme's colorSchemeSelector. */}
        <InitColorSchemeScript attribute="class" defaultMode="system" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
