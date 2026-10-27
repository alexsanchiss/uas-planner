import "./globals.css";
import type { Metadata, Viewport } from "next";
import React from "react";
import { Providers } from "./providers";
import { defaultLanguage, getTranslation } from "./i18n/translations";

// Static metadata cannot follow the language the user picks in the browser, so it uses the default language.
const tt = getTranslation(defaultLanguage).titles;

export const metadata: Metadata = {
  title: { template: `%s | ${tt.appName}`, default: tt.appName },
  description: tt.siteDescription,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Runs before first paint. Mirrors getStoredTheme() in hooks/useTheme.ts:
// saved "light"/"dark" wins, otherwise the system preference. Dark = no attribute.
// Also restores the saved UI language on <html lang> (I18nProvider keeps it in sync afterwards).
const THEME_SCRIPT = `(function(){try{var d=document.documentElement,s=localStorage.getItem("uas-planner-theme");if(s==="light"||(s!=="dark"&&window.matchMedia("(prefers-color-scheme: light)").matches)){d.setAttribute("data-theme","light")}var l=localStorage.getItem("uas-planner-language");if(l==="en"||l==="es"){d.lang=l}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang={defaultLanguage} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen flex flex-col bg-canvas text-fg"
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
