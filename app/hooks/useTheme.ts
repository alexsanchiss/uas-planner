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
function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  
  // Fall back to system preference
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

  // Listen for system preference changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    
    const handleChange = (e: MediaQueryListEvent) => {
      // Only update if user hasn't explicitly set a preference
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (!stored) {
        const newTheme = e.matches ? "light" : "dark";
        setThemeState(newTheme);
        applyTheme(newTheme, true);
      }
    };
    
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Listen for storage changes (cross-tab sync)
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        const newTheme = e.newValue as Theme;
        setThemeState(newTheme);
        applyTheme(newTheme, true);
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  /**
   * Set theme with transition and persistence
   */
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    applyTheme(newTheme, true);
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
