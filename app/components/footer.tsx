"use client";

import Link from "next/link";
import { useI18n } from "../i18n";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring";

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
      className={`relative rounded-sm text-sm transition-colors duration-300 ${FOCUS} ${
        transparent ? "text-white/70 hover:text-white" : "text-fg-2 hover:text-brand-text"
      } after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:transition-all after:duration-300 hover:after:w-full motion-reduce:after:transition-none ${
        transparent ? "after:bg-white/60" : "after:bg-brand-text"
      }`}
    >
      {children}
    </Link>
  );
}

/**
 * Theme-aware image: both sources are in the DOM and CSS picks one from the app theme
 * (no JS observer). On the transparent footer (over the dark shader) the light-on-dark source is always used.
 */
function ThemedImage({
  darkSrc,
  lightSrc,
  alt,
  width,
  height,
  className = "",
  forceDark = false,
}: {
  darkSrc: string;
  lightSrc: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  forceDark?: boolean;
}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={darkSrc}
        alt={alt}
        width={width}
        height={height}
        className={`${className} ${forceDark ? "" : "hidden dark:block"}`}
      />
      {!forceDark && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={lightSrc}
          alt={alt}
          width={width}
          height={height}
          className={`${className} block dark:hidden`}
        />
      )}
    </>
  );
}

export function Footer({ transparent = false }: { transparent?: boolean }) {
  const { t } = useI18n();
  const headingClass = `mb-1 text-xs font-semibold uppercase tracking-widest ${
    transparent ? "text-white/60" : "text-muted"
  }`;
  const logoLink = `rounded-sm transition-opacity duration-300 hover:opacity-80 ${FOCUS}`;

  return (
    <footer
      className={`relative ${
        transparent
          ? "border-t border-white/10 bg-transparent text-white/80 backdrop-blur-md"
          : "border-t border-line bg-canvas text-fg-2"
      }`}
    >
      <div className="container mx-auto grid grid-cols-1 items-start gap-10 px-6 py-10 text-center md:grid-cols-4 md:text-left">
        {/* Logos stacked vertically */}
        <div className="flex flex-col items-center justify-start space-y-5 md:items-start">
          <a href="https://sna-upv.com" target="_blank" rel="noopener noreferrer" className={logoLink}>
            <ThemedImage
              darkSrc="/images/SNA_WHITE.png"
              lightSrc="/images/SNA_DEEPBLUE.png"
              alt="SNA"
              width={120}
              height={100}
              className="p-[2px]"
              forceDark={transparent}
            />
          </a>
          <a href="https://www.upv.es" target="_blank" rel="noopener noreferrer" className={logoLink}>
            <ThemedImage
              darkSrc="/images/marca_UPV_principal_blanco150.png"
              lightSrc="/images/marca_UPV_principal_negro150.png"
              alt="UPV"
              width={160}
              height={90}
              className="p-[2px]"
              forceDark={transparent}
            />
          </a>
        </div>
        {/* Social media */}
        <div className="flex flex-col items-center justify-start space-y-4 md:items-start">
          <h2 className={headingClass}>{t.shell.connect}</h2>
          <a
            href="https://www.linkedin.com/company/sna-upv"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className={`${logoLink} hover:scale-105 motion-reduce:hover:scale-100`}
          >
            <ThemedImage
              darkSrc="/images/LinkedIN_white.svg"
              lightSrc="/images/LinkedIN_dark.svg"
              alt=""
              width={40}
              height={40}
              forceDark={transparent}
            />
          </a>
          <a
            href="https://www.instagram.com/sna_upv/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className={`${logoLink} hover:scale-105 motion-reduce:hover:scale-100`}
          >
            <ThemedImage
              darkSrc="/images/Instagram_white.svg"
              lightSrc="/images/Instagram_dark.svg"
              alt=""
              width={40}
              height={40}
              forceDark={transparent}
            />
          </a>
        </div>
        {/* Apps menu, in flow order */}
        <nav aria-label={t.shell.apps} className="flex flex-col items-center justify-start space-y-3 md:items-start">
          <h2 className={headingClass}>{t.shell.apps}</h2>
          <FooterLink href="/plan-definition" transparent={transparent}>
            {t.nav.planGenerator}
          </FooterLink>
          <FooterLink href="/plan-authorization" transparent={transparent}>
            {t.nav.trajectoryGenerator}
          </FooterLink>
          <FooterLink href="/plan-activation" transparent={transparent}>
            {t.nav.planActivation}
          </FooterLink>
        </nav>
        {/* Info menu */}
        <nav aria-label={t.shell.information} className="flex flex-col items-center justify-start space-y-3 md:items-start">
          <h2 className={headingClass}>{t.shell.information}</h2>
          <FooterLink href="/contact-us" transparent={transparent}>
            {t.nav.contactUs}
          </FooterLink>
          <FooterLink href="/how-it-works" transparent={transparent}>
            {t.nav.howItWorks}
          </FooterLink>
          <FooterLink href="/privacy-policy" transparent={transparent}>
            {t.nav.privacyPolicy}
          </FooterLink>
        </nav>
      </div>
      {/* Copyright row */}
      <div
        className={`w-full border-t py-4 text-center text-xs ${
          transparent
            ? "border-white/10 bg-transparent text-white/60"
            : "border-line bg-surface text-muted"
        }`}
      >
        &copy; {new Date().getFullYear()} U-PLAN PREPARATION SERVICE (UPPS) -{" "}
        <a
          href="https://www.sna-upv.com"
          target="_blank"
          rel="noopener noreferrer"
          className={`relative inline-block rounded-sm transition-colors duration-300 ${FOCUS} ${
            transparent ? "text-white/70 hover:text-white" : "text-muted hover:text-brand-text"
          } after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:transition-all after:duration-300 hover:after:w-full motion-reduce:after:transition-none ${
            transparent ? "after:bg-white/60" : "after:bg-brand-text"
          }`}
        >
          SNA Lab, UPV
        </a>
        . {t.shell.rightsReserved}
      </div>
    </footer>
  );
}
