"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MotionConfig } from "framer-motion";
import { Footer } from "./components/footer";
import { Header } from "./components/header";
import { AuthProvider } from "./components/auth/auth-provider";
import { ToastProvider } from "./components/ui/toast-provider";
import { I18nProvider, useI18n } from "./i18n";
import { Modal } from "./components/ui/modal";

/** Keeps <html lang> equal to the active UI language (layout.tsx renders the default language). */
function HtmlLang() {
  const { language } = useI18n();
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return null;
}

/**
 * Client shell of the app: providers, header/footer by pathname, welcome popup.
 * The shell owns the single <main>; pages must not render their own.
 * The theme is applied before paint by the inline script in layout.tsx.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSplash = pathname === "/";
  const isLaunch = pathname === "/launch";
  const [showDemoPopup, setShowDemoPopup] = useState(false);

  useEffect(() => {
    // Show if just logged in/signed up (sessionStorage flag)
    if (sessionStorage.getItem("showDemoPopupAfterAuth")) {
      setShowDemoPopup(true);
      sessionStorage.removeItem("showDemoPopupAfterAuth");
      return;
    }
    // Show for unregistered users first time on main page (localStorage flag)
    if (window.location.pathname === "/") {
      if (!localStorage.getItem("demoPopupShownForGuest")) {
        setShowDemoPopup(true);
        localStorage.setItem("demoPopupShownForGuest", "true");
      }
    }
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <I18nProvider>
        <HtmlLang />
        <AuthProvider>
          <ToastProvider>
            {!isSplash && <Header transparent={isLaunch} />}
            <Modal
              open={showDemoPopup}
              onClose={() => setShowDemoPopup(false)}
              title="Welcome to the SNA U-plan Preparation Service DEMO!"
            >
              <p className="mb-3">
                <span className="font-semibold">
                  This is a <span className="text-brand-text">DEMO</span> version
                  of our UPPS.
                </span>
              </p>
              <p className="mb-3">
                We are actively working to improve the app and user experience.
                Your effort in trying our app is greatly appreciated!
              </p>
              <p className="mb-3">
                We welcome all feedback and encourage you to get in touch via the{" "}
                <Link href="/contact-us" onClick={() => setShowDemoPopup(false)} className="text-brand-text hover:underline">
                  Contact
                </Link>{" "}
                section.
              </p>
              <p>
                Want to know more? Learn how the system works in the{" "}
                <Link href="/how-it-works" onClick={() => setShowDemoPopup(false)} className="text-brand-text hover:underline">
                  How it works
                </Link>{" "}
                section.
              </p>
            </Modal>
            <main className="flex-1 flex flex-col">{children}</main>
            {!isSplash && <Footer transparent={isLaunch} />}
          </ToastProvider>
        </AuthProvider>
      </I18nProvider>
    </MotionConfig>
  );
}
