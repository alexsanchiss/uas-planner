"use client";

import "./globals.css";
import { Footer } from "./components/footer";
import { Header } from "./components/header";
import React, { useEffect, useState } from "react";
import { Modal } from "./components/ui/modal";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showDemoPopup, setShowDemoPopup] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
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
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Header />
        <Modal
          open={showDemoPopup}
          onClose={() => setShowDemoPopup(false)}
          title="Welcome to the SNA U-plan Preparation Service DEMO!"
        >
          <p className="mb-3">
            <span className="font-semibold">
              This is a <span className="text-blue-400">DEMO</span> version of
              our UPPS.
            </span>
          </p>
          <p className="mb-3">
            We are actively working to improve the app and user experience. Your
            effort in trying our app is greatly appreciated!
          </p>
          <p className="mb-3">
            We welcome all feedback and encourage you to get in touch via the{" "}
            <a
              href="/contact-us"
              className="text-blue-400 hover:underline hover:text-blue-300"
            >
              Contact
            </a>{" "}
            section.
          </p>
          <p>
            Want to know more? Learn how the system works in the{" "}
            <a
              href="/how-it-works"
              className="text-blue-400 hover:underline hover:text-blue-300"
            >
              How it works
            </a>{" "}
            section.
          </p>
        </Modal>
        <main className="flex-1 flex flex-col">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
