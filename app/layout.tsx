import "./globals.css";
import type { Metadata, Viewport } from "next";
import React from "react";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: { template: "%s · UPPS", default: "UPPS" },
  description:
    "UPPS: servicio de preparación de U-plans y planes de vuelo para operadores de drones.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Runs before first paint. Mirrors getStoredTheme() in hooks/useTheme.ts:
// saved "light"/"dark" wins, otherwise the system preference. Dark = no attribute.
const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem("uas-planner-theme");if(s==="light"||(s!=="dark"&&window.matchMedia("(prefers-color-scheme: light)").matches)){document.documentElement.setAttribute("data-theme","light")}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]"
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
