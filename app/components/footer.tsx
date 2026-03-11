"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

/**
 * Footer link with animated underline on hover
 */
function FooterLink({
  href,
  transparent,
  children,
}: {
  href: string;
  transparent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`relative text-sm transition-colors duration-300 ${
        transparent
          ? 'text-white/70 hover:text-white'
          : 'text-[var(--text-secondary)] hover:text-[var(--color-primary)]'
      } after:absolute after:bottom-0 after:left-0 after:w-0 after:h-px after:transition-all after:duration-300 hover:after:w-full ${
        transparent ? 'after:bg-white/60' : 'after:bg-[var(--color-primary)]'
      }`}
    >
      {children}
    </Link>
  );
}

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

export function Footer({ transparent = false }: { transparent?: boolean }) {
  return (
    <footer className={`relative z-[100] ${
      transparent
        ? 'bg-transparent backdrop-blur-md text-white/80 border-t border-white/10'
        : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-t border-[var(--border-primary)]'
    }`}>
      <div className="container mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-4 gap-10 items-start text-center md:text-left">
        {/* Logos stacked vertically */}
        <div className="flex flex-col items-center md:items-start justify-start space-y-5">
          <a
            href="https://sna-upv.com"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-opacity duration-300 hover:opacity-80"
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
            className="transition-opacity duration-300 hover:opacity-80"
          >
            <ThemedImage
              darkSrc="/images/marca_UPV_principal_blanco150.png"
              lightSrc="/images/marca_UPV_principal_negro150.png"
              alt="UPV Logo"
              width={160}
              height={90}
              className="p-[2px]"
            />
          </a>
        </div>
        {/* Social media */}
        <div className="flex flex-col items-center md:items-start justify-start space-y-4">
          <h3 className={`text-xs font-semibold uppercase tracking-widest mb-1 ${
            transparent ? 'text-white/50' : 'text-[var(--text-muted)]'
          }`}>Connect</h3>
          <a
            href="https://www.linkedin.com/company/sna-upv"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="transition-all duration-300 hover:opacity-80 hover:scale-105"
          >
            <ThemedImage
              darkSrc="/images/LinkedIN_white.svg"
              lightSrc="/images/LinkedIN_dark.svg"
              alt="LinkedIn"
              width={40}
              height={40}
            />
          </a>
          <a
            href="https://www.instagram.com/sna_upv/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="transition-all duration-300 hover:opacity-80 hover:scale-105"
          >
            <ThemedImage
              darkSrc="/images/Instagram_white.svg"
              lightSrc="/images/Instagram_dark.svg"
              alt="Instagram"
              width={40}
              height={40}
            />
          </a>
        </div>
        {/* Apps menu */}
        <div className="flex flex-col items-center md:items-start justify-start space-y-3">
          <h3 className={`text-xs font-semibold uppercase tracking-widest mb-1 ${
            transparent ? 'text-white/50' : 'text-[var(--text-muted)]'
          }`}>Apps</h3>
          <FooterLink href="/plan-definition" transparent={transparent}>
            Plan Definition
          </FooterLink>
          <FooterLink href="/plan-authorization" transparent={transparent}>
            Plan Authorization
          </FooterLink>
          <FooterLink href="/plan-activation" transparent={transparent}>
            Plan Activation
          </FooterLink>
        </div>
        {/* Info menu */}
        <div className="flex flex-col items-center md:items-start justify-start space-y-3">
          <h3 className={`text-xs font-semibold uppercase tracking-widest mb-1 ${
            transparent ? 'text-white/50' : 'text-[var(--text-muted)]'
          }`}>Information</h3>
          <FooterLink href="/contact-us" transparent={transparent}>
            Contact Us
          </FooterLink>
          <FooterLink href="/how-it-works" transparent={transparent}>
            How it works?
          </FooterLink>
          <FooterLink href="/privacy-policy" transparent={transparent}>
            Privacy Policy
          </FooterLink>
        </div>
      </div>
      {/* Copyright row */}
      <div className={`w-full text-xs text-center py-4 border-t ${
        transparent
          ? 'bg-transparent text-white/40 border-white/10'
          : 'bg-[var(--surface-primary)] text-[var(--text-muted)] border-[var(--border-primary)]'
      }`}>
        &copy; {new Date().getFullYear()} U-PLAN PREPARATION SERVICE (UPPS) -{" "}
        <a
          href="https://www.sna-upv.com"
          target="_blank"
          rel="noopener noreferrer"
          className={`relative inline-block transition-colors duration-300 ${
            transparent
              ? 'text-white/60 hover:text-white/90'
              : 'text-[var(--text-muted)] hover:text-[var(--color-primary)]'
          } after:absolute after:bottom-0 after:left-0 after:w-0 after:h-px after:transition-all after:duration-300 hover:after:w-full ${
            transparent ? 'after:bg-white/60' : 'after:bg-[var(--color-primary)]'
          }`}
        >
          SNA Lab, UPV
        </a>
        . All rights reserved.
      </div>
    </footer>
  );
}
