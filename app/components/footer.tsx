"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

/**
 * Theme-aware image component for footer
 * Uses MutationObserver to watch for data-theme changes, same logic as header
 */
function ThemedImage({ 
  darkSrc, 
  lightSrc, 
  alt, 
  width, 
  height, 
  className 
}: { 
  darkSrc: string; 
  lightSrc: string; 
  alt: string; 
  width: number; 
  height: number; 
  className?: string;
}) {
  const [isLightTheme, setIsLightTheme] = useState(false);
  
  useEffect(() => {
    // Check initial theme
    const checkTheme = () => {
      setIsLightTheme(document.documentElement.getAttribute('data-theme') === 'light');
    };
    
    checkTheme();
    
    // Watch for theme changes using MutationObserver
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          checkTheme();
        }
      });
    });
    
    observer.observe(document.documentElement, { attributes: true });
    
    return () => observer.disconnect();
  }, []);
  
  return (
    <img
      src={isLightTheme ? lightSrc : darkSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
    />
  );
}

export function Footer() {
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
            <ThemedImage
              darkSrc="/images/SNA_WHITE.png"
              lightSrc="/images/SNA_DEEPBLUE.png"
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
            <ThemedImage
              darkSrc="/images/marca_UPV_principal_blanco150.png"
              lightSrc="/images/marca_UPV_principal_negro150.png"
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
            <ThemedImage
              darkSrc="/images/LinkedIN_white.svg"
              lightSrc="/images/LinkedIN_dark.svg"
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
            <ThemedImage
              darkSrc="/images/Instagram_white.svg"
              lightSrc="/images/Instagram_dark.svg"
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
            href="/plan-definition"
            className="hover:text-[var(--color-primary)] transition"
          >
            Plan Definition
          </Link>
          <Link
            href="/plan-authorization"
            className="hover:text-[var(--color-primary)] transition"
          >
            Plan Authorization
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
