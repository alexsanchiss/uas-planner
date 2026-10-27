"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, LogOut, Menu, Settings, User, X } from "lucide-react";
import { ThemeToggle } from "./ui/theme-toggle";
import { useAuth } from "../hooks/useAuth";
import { useI18n } from "../i18n";
import { BrandMark } from "./brand-mark";

/** Shared focus ring: visible for keyboard users on both the themed and the transparent (launch) header. */
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring";

/**
 * Loading skeleton component for user info
 */
function UserSkeleton() {
  return (
    <div className="flex items-center space-x-2 animate-pulse motion-reduce:animate-none" aria-hidden="true">
      <div className="h-8 w-8 rounded-full bg-hover" />
      <div className="h-4 w-24 rounded bg-hover" />
    </div>
  );
}

/**
 * User menu: a disclosure with plain links (no ARIA menu role, so no arrow-key contract to fulfil).
 * Escape closes it and returns focus to the trigger; a click outside closes it.
 */
function UserDropdown({
  username,
  onLogout,
  transparent,
}: {
  username: string;
  onLogout: () => void;
  transparent?: boolean;
}) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const itemClass = `flex w-full items-center gap-3 px-4 py-2 text-sm text-fg-2 transition-colors hover:bg-hover hover:text-fg ${FOCUS} focus-visible:ring-inset`;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 rounded-lg p-2 transition-colors duration-200 ${
          transparent ? "text-white hover:bg-white/10" : "text-fg-2 hover:bg-hover"
        } ${FOCUS}`}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        aria-label={`${t.shell.userMenu}: ${username}`}
      >
        <Image
          src="/images/pfp.jpg"
          alt=""
          width={32}
          height={32}
          className="rounded-full"
        />
        <span className="hidden max-w-[10rem] truncate sm:inline">{username}</span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          id={panelId}
          className="absolute right-0 z-10 mt-2 w-56 rounded-lg border border-line bg-surface-elevated py-1 shadow-theme-lg"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm text-muted">{t.auth.signedInAs}</p>
            <p className="truncate text-sm font-medium text-fg">{username}</p>
          </div>

          <div className="py-1">
            <Link href="/profile" className={itemClass} onClick={() => setIsOpen(false)}>
              <User className="h-4 w-4" aria-hidden="true" />
              {t.nav.profile}
            </Link>
            <Link href="/settings" className={itemClass} onClick={() => setIsOpen(false)}>
              <Settings className="h-4 w-4" aria-hidden="true" />
              {t.nav.settings}
            </Link>
          </div>

          <div className="border-t border-line py-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className={`flex w-full items-center gap-3 px-4 py-2 text-sm text-danger-text transition-colors hover:bg-hover ${FOCUS} focus-visible:ring-inset`}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {t.auth.logout}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** "Log in" link: tokens only, so it stays readable in both themes (the old outline button was gray-on-white in light). */
function LoginLink({ transparent, compact }: { transparent?: boolean; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <Link
      href="/login"
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md border text-sm font-medium transition-colors ${
        compact ? "px-3 py-1.5 sm:px-4 sm:py-2" : "px-4 py-2"
      } ${
        transparent
          ? "border-white/40 text-white hover:bg-white/10"
          : "border-line-2 bg-surface-2 text-fg hover:bg-hover"
      } ${FOCUS}`}
    >
      {t.auth.login}
    </Link>
  );
}

export function Header({ transparent = false }: { transparent?: boolean }) {
  const { user, loading, logout } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavId = useId();

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Escape closes the mobile menu and gives focus back to its button
  useEffect(() => {
    if (!mobileMenuOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [mobileMenuOpen]);

  // Flow order: define the plan, get it authorized, activate the flight.
  const navLinks = [
    { href: "/plan-definition", label: t.nav.planGenerator },
    { href: "/plan-authorization", label: t.nav.trajectoryGenerator },
    { href: "/plan-activation", label: t.nav.planActivation },
  ];

  const pillClass = (active: boolean, mobile: boolean) =>
    `rounded-full text-sm font-medium transition-colors duration-200 ${FOCUS} ${
      mobile ? "block px-4 py-3 text-center" : "px-5 py-2"
    } ${
      transparent
        ? active
          ? "border border-white/25 bg-white/15 text-white"
          : "border border-transparent text-white/80 hover:border-white/15 hover:bg-white/10 hover:text-white"
        : active
          ? "bg-brand text-brand-fg shadow-theme-sm"
          : "text-fg-2 hover:bg-hover hover:text-fg"
    }`;

  const accountControls = (compact: boolean) =>
    loading ? (
      compact ? (
        <div className="h-8 w-8 animate-pulse rounded-full bg-hover motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        <UserSkeleton />
      )
    ) : user ? (
      <UserDropdown username={user.username} onLogout={logout} transparent={transparent} />
    ) : (
      <LoginLink transparent={transparent} compact={compact} />
    );

  return (
    <header
      className={`relative z-[9999] ${
        transparent
          ? "border-b border-white/10 bg-transparent backdrop-blur-md"
          : "bg-surface shadow-theme-md"
      }`}
    >
      <div className="container mx-auto px-4 py-3">
        {/* Desktop layout */}
        <div className="hidden items-center lg:grid lg:grid-cols-3">
          <nav aria-label={t.shell.mainNav} className="flex items-center space-x-2">
            {navLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={pillClass(active, false)}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex flex-shrink-0 justify-center">
            <Link href="/" aria-label={t.shell.brandHome} className={`flex-shrink-0 rounded-md ${FOCUS}`}>
              <BrandMark transparent={transparent} />
            </Link>
          </div>
          <div className="flex items-center justify-end space-x-4">
            <ThemeToggle />
            {accountControls(false)}
          </div>
        </div>

        {/* Mobile/Tablet layout */}
        <div className="flex items-center justify-between lg:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`rounded-lg p-2 transition-colors ${
              transparent ? "text-white hover:bg-white/10" : "text-fg-2 hover:bg-hover"
            } ${FOCUS}`}
            aria-label={mobileMenuOpen ? t.shell.closeMenu : t.shell.openMenu}
            aria-expanded={mobileMenuOpen}
            aria-controls={mobileNavId}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6" aria-hidden="true" />
            )}
          </button>

          <Link href="/" aria-label={t.shell.brandHome} className={`flex-shrink-0 rounded-md ${FOCUS}`}>
            <BrandMark compact transparent={transparent} />
          </Link>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <ThemeToggle />
            {accountControls(true)}
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <nav
            id={mobileNavId}
            aria-label={t.shell.mainNav}
            className={`mt-3 flex flex-col space-y-2 border-t pb-3 pt-3 lg:hidden ${
              transparent ? "border-white/10" : "border-line"
            }`}
          >
            {navLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                  className={pillClass(active, true)}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}
