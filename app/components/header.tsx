"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { ThemeToggle } from "./ui/theme-toggle";
import { useAuthContext } from "./auth/auth-provider";

/**
 * Loading skeleton component for user info
 */
function UserSkeleton() {
  return (
    <div className="flex items-center space-x-2 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-gray-600" />
      <div className="w-24 h-4 bg-gray-600 rounded" />
    </div>
  );
}

/**
 * User dropdown menu with profile and logout options
 */
function UserDropdown({ 
  username, 
  onLogout 
}: { 
  username: string; 
  onLogout: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Image
          src="/images/pfp.jpg"
          alt="User Profile"
          width={32}
          height={32}
          className="rounded-full"
        />
        <span className="text-gray-300">{username}</span>
        <svg 
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-56 bg-gray-700 rounded-lg shadow-lg border border-gray-600 py-1 z-50"
          role="menu"
          aria-orientation="vertical"
        >
          {/* User info header */}
          <div className="px-4 py-3 border-b border-gray-600">
            <p className="text-sm text-gray-400">Signed in as</p>
            <p className="text-sm font-medium text-white truncate">{username}</p>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <Link
              href="/profile"
              className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
              role="menuitem"
              onClick={() => setIsOpen(false)}
            >
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile
            </Link>
            <Link
              href="/settings"
              className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
              role="menuitem"
              onClick={() => setIsOpen(false)}
            >
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </Link>
          </div>

          {/* Logout */}
          <div className="border-t border-gray-600 py-1">
            <button
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="flex items-center w-full px-4 py-2 text-sm text-red-400 hover:bg-gray-600 hover:text-red-300 transition-colors"
              role="menuitem"
            >
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Hamburger menu icon for mobile navigation
 */
function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <div className="w-6 h-6 flex flex-col justify-center items-center">
      <span
        className={`block h-0.5 w-6 bg-gray-300 transition-all duration-300 ${
          open ? 'rotate-45 translate-y-1.5' : ''
        }`}
      />
      <span
        className={`block h-0.5 w-6 bg-gray-300 transition-all duration-300 my-1 ${
          open ? 'opacity-0' : ''
        }`}
      />
      <span
        className={`block h-0.5 w-6 bg-gray-300 transition-all duration-300 ${
          open ? '-rotate-45 -translate-y-1.5' : ''
        }`}
      />
    </div>
  );
}

export function Header() {
  const { user, loading, logout } = useAuthContext();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => pathname === path;

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile menu on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const navLinks = [
    { href: "/plan-generator", label: "Plan Generator" },
    { href: "/trajectory-generator", label: "Trajectory Generator" },
    { href: "/plan-activation", label: "Plan Activation" },
  ];

  return (
    <header className="bg-gray-800 shadow-md relative z-50">
      <div className="container mx-auto px-4 py-3">
        {/* Desktop layout */}
        <div className="hidden lg:grid lg:grid-cols-3 items-center">
          {/* Navegación a la izquierda */}
          <div className="flex items-center space-x-4">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="group">
                <div
                  className={`px-3 py-2 rounded-lg border transition-all duration-200 cursor-pointer shadow-sm
                    ${
                      isActive(link.href)
                        ? "bg-blue-700 border-blue-800 text-white shadow-lg"
                        : "bg-gray-700/60 border-gray-600 text-gray-200 group-hover:bg-blue-800 group-hover:text-white group-hover:shadow-lg"
                    }
                    hover:scale-105 hover:shadow-xl`}
                >
                  {link.label}
                </div>
              </Link>
            ))}
          </div>
          {/* Logo centrado */}
          <div className="flex justify-center">
            <Link href="/">
              <Image
                src="/images/logo.jpg"
                alt="UAS PLANNER Logo"
                width={150}
                height={50}
              />
            </Link>
          </div>
          {/* Botones de usuario a la derecha */}
          <div className="flex justify-end items-center space-x-4">
            <ThemeToggle />
            {loading ? (
              <UserSkeleton />
            ) : user ? (
              <UserDropdown username={user.username} onLogout={logout} />
            ) : (
              <Link href="/login">
                <Button variant="outline">Log in</Button>
              </Link>
            )}
          </div>
        </div>

        {/* Mobile/Tablet layout */}
        <div className="lg:hidden flex items-center justify-between">
          {/* Hamburger button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            <HamburgerIcon open={mobileMenuOpen} />
          </button>

          {/* Logo centered */}
          <Link href="/" className="flex-shrink-0">
            <Image
              src="/images/logo.jpg"
              alt="UAS PLANNER Logo"
              width={120}
              height={40}
              className="sm:w-[150px] sm:h-[50px]"
            />
          </Link>

          {/* User controls */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <ThemeToggle />
            {loading ? (
              <div className="w-8 h-8 rounded-full bg-gray-600 animate-pulse" />
            ) : user ? (
              <UserDropdown username={user.username} onLogout={logout} />
            ) : (
              <Link href="/login">
                <Button variant="outline" className="text-sm px-2 py-1 sm:px-4 sm:py-2">Log in</Button>
              </Link>
            )}
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-3 pb-3 border-t border-gray-700 pt-3 animate-fadeIn">
            <nav className="flex flex-col space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-lg border transition-all duration-200 text-center
                    ${
                      isActive(link.href)
                        ? "bg-blue-700 border-blue-800 text-white"
                        : "bg-gray-700/60 border-gray-600 text-gray-200 hover:bg-blue-800 hover:text-white"
                    }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
