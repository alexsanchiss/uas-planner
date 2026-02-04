import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Legacy support
        background: "var(--background)",
        foreground: "var(--foreground)",
        
        // Theme-aware colors (TASK-163)
        theme: {
          // Backgrounds
          "bg-primary": "var(--bg-primary)",
          "bg-secondary": "var(--bg-secondary)",
          "bg-tertiary": "var(--bg-tertiary)",
          "bg-hover": "var(--bg-hover)",
          "bg-active": "var(--bg-active)",
          
          // Surfaces
          "surface-primary": "var(--surface-primary)",
          "surface-secondary": "var(--surface-secondary)",
          "surface-elevated": "var(--surface-elevated)",
          
          // Text
          "text-primary": "var(--text-primary)",
          "text-secondary": "var(--text-secondary)",
          "text-tertiary": "var(--text-tertiary)",
          "text-muted": "var(--text-muted)",
          
          // Borders
          "border-primary": "var(--border-primary)",
          "border-secondary": "var(--border-secondary)",
          "border-hover": "var(--border-hover)",
          
          // Brand
          "brand-primary": "var(--brand-primary)",
          "brand-primary-hover": "var(--brand-primary-hover)",
          "brand-secondary": "var(--brand-secondary)",
          
          // Status
          "status-success": "var(--status-success)",
          "status-warning": "var(--status-warning)",
          "status-error": "var(--status-error)",
          "status-info": "var(--status-info)",
          
          // Input
          "input-bg": "var(--input-bg)",
          "input-border": "var(--input-border)",
          "input-focus": "var(--input-focus)",
        },
      },
      backgroundColor: {
        "app-sidebar": "var(--app-sidebar-bg)",
      },
      borderColor: {
        "theme-primary": "var(--border-primary)",
        "theme-secondary": "var(--border-secondary)",
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
