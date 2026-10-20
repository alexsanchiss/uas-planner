/**
 * useTheme Hook - Theme Management
 * 
 * Manages theme state with:
 * - localStorage persistence
 * - System preference detection
 * - Smooth transitions when switching
 * 
 * TASK-158, TASK-159, TASK-165
 */

"use client";

import { useState, useEffect, useCallback } from "react";

export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "uas-planner-theme";
const THEME_CHANGE_EVENT = "uas-planner-theme-change";

/**
 * Get the system's preferred color scheme
 */
function getSystemPreference(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

/**
 * Get the stored theme preference or fall back to system preference
 */
export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  
  // No saved preference — detect system preference
  return getSystemPreference();
}

/**
 * Apply theme to DOM
 */
function applyTheme(theme: Theme, enableTransition: boolean = false) {
  if (typeof document === "undefined") return;
  
  const root = document.documentElement;
  
  // Enable transition class for smooth switching
  if (enableTransition) {
    root.classList.add("theme-transition");
  }
  
  // Apply theme
  if (theme === "light") {
    root.setAttribute("data-theme", "light");
  } else {
    root.removeAttribute("data-theme");
  }
  
  // Remove transition class after animation completes
  if (enableTransition) {
    setTimeout(() => {
      root.classList.remove("theme-transition");
    }, 300);
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    const initialTheme = getStoredTheme();
    setThemeState(initialTheme);
    applyTheme(initialTheme, false);
    setMounted(true);
  }, []);

  // The system preference is only used when no app theme has been saved.

  // Keep duplicate controls in this window and other tabs in sync.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncTheme = () => {
      const currentTheme = getStoredTheme();
      setThemeState(currentTheme);
      const rootTheme =
        document.documentElement.getAttribute("data-theme") === "light"
          ? "light"
          : "dark";
      if (rootTheme !== currentTheme) applyTheme(currentTheme, true);
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) syncTheme();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(THEME_CHANGE_EVENT, syncTheme);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(THEME_CHANGE_EVENT, syncTheme);
    };
  }, []);

  /**
   * Set theme with transition and persistence
   */
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    applyTheme(newTheme, true);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  /**
   * Toggle between light and dark themes
   */
  const toggleTheme = useCallback(() => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  }, [theme, setTheme]);

  /**
   * Reset to system preference
   */
  const resetToSystem = useCallback(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    const systemTheme = getSystemPreference();
    setThemeState(systemTheme);
    applyTheme(systemTheme, true);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  return {
    theme,
    setTheme,
    toggleTheme,
    resetToSystem,
    isDark: theme === "dark",
    isLight: theme === "light",
    mounted, // Use this to prevent hydration mismatch
  };
}

export default useTheme;
