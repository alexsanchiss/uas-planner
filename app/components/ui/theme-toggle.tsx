/**
 * ThemeToggle Component
 * 
 * Toggle button with sun/moon icons for switching between themes
 * 
 * TASK-160
 */

"use client";

import React from "react";
import { useTheme } from "@/app/hooks/useTheme";

interface ThemeToggleProps {
  className?: string;
}

/**
 * Sun icon for light mode
 */
function SunIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

/**
 * Moon icon for dark mode
 */
function MoonIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  );
}

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme, mounted } = useTheme();

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <button
        className={`
          p-2 rounded-lg 
          bg-[var(--bg-tertiary)] 
          text-[var(--text-secondary)]
          ${className}
        `}
        aria-label="Toggle theme"
        disabled
      >
        <div className="w-5 h-5" />
      </button>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className={`
        relative p-2 rounded-lg 
        bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]
        text-[var(--text-secondary)] hover:text-[var(--text-primary)]
        transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]
        ${className}
      `}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <div className="relative w-5 h-5">
        {/* Sun icon - visible in dark mode (click to go light) */}
        <span
          className={`
            absolute inset-0 transform transition-all duration-300
            ${isDark 
              ? "opacity-100 rotate-0 scale-100" 
              : "opacity-0 rotate-90 scale-0"
            }
          `}
        >
          <SunIcon className="w-5 h-5 text-yellow-400" />
        </span>
        
        {/* Moon icon - visible in light mode (click to go dark) */}
        <span
          className={`
            absolute inset-0 transform transition-all duration-300
            ${isDark 
              ? "opacity-0 -rotate-90 scale-0" 
              : "opacity-100 rotate-0 scale-100"
            }
          `}
        >
          <MoonIcon className="w-5 h-5 text-blue-500" />
        </span>
      </div>
    </button>
  );
}

export default ThemeToggle;
