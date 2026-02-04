"use client";

import Link from "next/link";
import { useTheme } from "../hooks/useTheme";

export function Footer() {
  const { isDark, mounted } = useTheme();

  // Don't render images until mounted to prevent hydration mismatch
  // After mounted, use the actual theme value for dynamic updates
  if (!mounted) {
    // Return a placeholder during SSR/hydration
    return (
      <footer className="bg-[var(--bg-primary)] text-[var(--text-secondary)] border-t border-[var(--border-primary)]">
        <div className="container mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-4 gap-8 items-center text-center min-h-[200px]" />
      </footer>
    );
  }

  const snaLogo = isDark ? "/images/SNA_WHITE.png" : "/images/SNA_DEEPBLUE.png";
  const upvLogo = isDark ? "/images/marca_UPV_principal_blanco150.png" : "/images/marca_UPV_principal_negro150.png";
  const linkedInIcon = isDark ? "/images/LinkedIN_white.svg" : "/images/LinkedIN_dark.svg";
  const instagramIcon = isDark ? "/images/Instagram_white.svg" : "/images/Instagram_dark.svg";

  return (
    <footer className="bg-[var(--bg-primary)] text-[var(--text-secondary)] border-t border-[var(--border-primary)]">
      <div className="container mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-4 gap-8 items-center text-center">
        {/* Logos stacked vertically and centered */}
        <div className="flex flex-col items-center justify-center space-y-4">
          <a
            href="https://sna-upv.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            {/* Use regular img instead of Next.js Image for immediate theme updates */}
            <img
              src={snaLogo}
              alt="SNA Logo"
              width={120}
              height={100}
              className="p-[2px]"
            />
          </a>
          <a
            href="https://www.upv.es"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src={upvLogo}
              alt="UPV Logo"
              width={160}
              height={90}
              className="p-[2px] mt-0 !mt-0"
            />
          </a>
        </div>
        {/* Social media icons stacked vertically and centered */}
        <div className="flex flex-col items-center justify-center space-y-6">
          <a
            href="https://www.linkedin.com/company/sna-upv"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="hover:opacity-80"
          >
            <img
              src={linkedInIcon}
              alt="LinkedIn"
              width={48}
              height={48}
            />
          </a>
          <a
            href="https://www.instagram.com/sna_upv/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="hover:opacity-80"
          >
            <img
              src={instagramIcon}
              alt="Instagram"
              width={48}
              height={48}
            />
          </a>
        </div>
        {/* Main menu */}
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="font-semibold mb-2">Apps</div>
          <Link
            href="/plan-generator"
            className="hover:text-[var(--color-primary)] transition"
          >
            Plan Generator
          </Link>
          <Link
            href="/trajectory-generator"
            className="hover:text-[var(--color-primary)] transition"
          >
            Trajectory Generator
          </Link>
          <Link
            href="/plan-activation"
            className="hover:text-[var(--color-primary)] transition"
          >
            Plan Activation
          </Link>
        </div>
        {/* Info menu */}
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="font-semibold mb-2">Information</div>
          <Link href="/contact-us" className="hover:text-[var(--color-primary)] transition">
            Contact Us
          </Link>
          <Link href="/how-it-works" className="hover:text-[var(--color-primary)] transition">
            How it works?
          </Link>
          <Link
            href="/privacy-policy"
            className="hover:text-[var(--color-primary)] transition"
          >
            Privacy Policy
          </Link>
        </div>
      </div>
      {/* Copyright row */}
      <div className="w-full bg-[var(--surface-primary)] text-[var(--text-muted)] text-xs text-center py-4 border-t border-[var(--border-primary)]">
        &copy; {new Date().getFullYear()} U-PLAN PREPARATION SERVICE (UPPS) -{" "}
        <a
          href="https://www.sna-upv.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-[var(--color-primary)] transition"
        >
          SNA Lab, UPV
        </a>
        . All rights reserved.
      </div>
    </footer>
  );
}
