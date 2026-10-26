import type { Config } from "tailwindcss";

// Semantic names -> CSS custom properties in app/styles/themes.css (single source of truth).
// Use `bg-surface text-fg`, `text-muted`, `border-line`, `bg-danger text-danger-fg`... instead of raw palette classes.
// Caveat: var() colors are opaque to Tailwind, so `/50` opacity modifiers do not work; use the `-soft` variants.
const config: Config = {
  // The app toggle (useTheme.ts) is: dark = no attribute on <html>, light = data-theme="light".
  // `dark:` must therefore be "inside a root that is NOT light", never the OS media query.
  darkMode: ["variant", '&:not([data-theme="light"] *)'],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces (bg-canvas, bg-surface, bg-surface-2, bg-subtle, bg-hover)
        canvas: "var(--bg-primary)",
        surface: {
          DEFAULT: "var(--surface-primary)",
          2: "var(--surface-secondary)",
          elevated: "var(--surface-elevated)",
        },
        subtle: "var(--bg-tertiary)",
        hover: "var(--bg-hover)",
        // Text (text-fg, text-fg-2; text-muted comes from textColor below)
        fg: {
          DEFAULT: "var(--text-primary)",
          2: "var(--text-secondary)",
        },
        // Borders (border-line, border-line-2)
        line: {
          DEFAULT: "var(--border-primary)",
          2: "var(--border-secondary)",
          hover: "var(--border-hover)",
        },
        // Brand: DEFAULT is the solid button fill (AA with brand-fg); `text` is the AA link/text tone; `ring` the focus ring.
        brand: {
          DEFAULT: "var(--btn-primary-bg)",
          hover: "var(--btn-primary-bg-hover)",
          active: "var(--btn-primary-bg-active)",
          fg: "var(--btn-primary-text)",
          text: "var(--color-primary-text)",
          ring: "var(--color-primary)",
        },
        // Status: DEFAULT = solid fill, fg = text on it, soft = tinted bg, line = tinted border, text = AA text on soft/surface
        success: {
          DEFAULT: "var(--btn-success-bg)",
          hover: "var(--btn-success-bg-hover)",
          fg: "var(--btn-success-text)",
          soft: "var(--status-success-bg)",
          line: "var(--status-success-border)",
          text: "var(--status-success-text)",
        },
        warning: {
          DEFAULT: "var(--btn-warning-bg)",
          hover: "var(--btn-warning-bg-hover)",
          fg: "var(--btn-warning-text)",
          soft: "var(--status-warning-bg)",
          line: "var(--status-warning-border)",
          text: "var(--status-warning-text)",
        },
        danger: {
          DEFAULT: "var(--btn-danger-bg)",
          hover: "var(--btn-danger-bg-hover)",
          fg: "var(--btn-danger-text)",
          soft: "var(--status-error-bg)",
          line: "var(--status-error-border)",
          text: "var(--status-error-text)",
        },
        info: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          fg: "var(--btn-primary-text)",
          soft: "var(--status-info-bg)",
          line: "var(--status-info-border)",
          text: "var(--status-info-text)",
        },
      },
      // text-muted must not also generate bg-muted/border-muted, so it lives in textColor only.
      textColor: {
        muted: "var(--text-muted)",
      },
      backgroundColor: {
        "app-sidebar": "var(--app-sidebar-bg)",
        input: "var(--input-bg)",
        overlay: "var(--overlay-bg)",
      },
      borderColor: {
        input: "var(--input-border)",
      },
      boxShadow: {
        "theme-sm": "var(--shadow-sm)",
        "theme-md": "var(--shadow-md)",
        "theme-lg": "var(--shadow-lg)",
      },
    },
  },
  plugins: [],
};
export default config;
