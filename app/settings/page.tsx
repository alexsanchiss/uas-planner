"use client";

import { useTheme } from "../hooks/useTheme";
import { ProtectedRoute } from "../components/auth/protected-route";
import { Settings, Sun, Moon, Mail, HelpCircle, Shield, Bell } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const { theme, setTheme, isDark } = useTheme();

  const themeOptions = [
    { value: "dark" as const, label: "Dark", icon: Moon, description: "Dark theme for low-light environments" },
    { value: "light" as const, label: "Light", icon: Sun, description: "Light theme for bright environments" },
  ];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[var(--bg-primary)] py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[var(--text-primary)] flex items-center gap-3">
              <Settings className="w-8 h-8" />
              Settings
            </h1>
            <p className="text-[var(--text-muted)] mt-1">Customize your experience</p>
          </div>

          {/* Theme Section */}
          <div className="bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-xl p-6 shadow-lg mb-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              Appearance
            </h2>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Choose how the application looks on your device
            </p>

            <div className="grid gap-3">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = theme === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setTheme(option.value)}
                    className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]"
                        : "border-[var(--border-primary)] bg-[var(--bg-secondary)] hover:border-[var(--border-hover)]"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isSelected ? "bg-[var(--color-primary)] text-white" : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${isSelected ? "text-[var(--color-primary)]" : "text-[var(--text-primary)]"}`}>
                        {option.label}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">{option.description}</p>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notifications Section (Placeholder) */}
          <div className="bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-xl p-6 shadow-lg mb-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
            </h2>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Notification preferences coming soon
            </p>
            <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
              <p className="text-[var(--text-tertiary)] text-sm text-center">
                Email and push notification settings will be available in a future update.
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-xl p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Quick Links</h2>
            <div className="grid gap-3">
              <Link
                href="/contact-us"
                className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <Mail className="w-5 h-5 text-[var(--color-primary)]" />
                <div>
                  <p className="font-medium text-[var(--text-primary)]">Contact Us</p>
                  <p className="text-xs text-[var(--text-muted)]">Get in touch with our team</p>
                </div>
              </Link>
              <Link
                href="/how-it-works"
                className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <HelpCircle className="w-5 h-5 text-[var(--color-primary)]" />
                <div>
                  <p className="font-medium text-[var(--text-primary)]">How It Works</p>
                  <p className="text-xs text-[var(--text-muted)]">Learn about the system</p>
                </div>
              </Link>
              <Link
                href="/privacy-policy"
                className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <Shield className="w-5 h-5 text-[var(--color-primary)]" />
                <div>
                  <p className="font-medium text-[var(--text-primary)]">Privacy Policy</p>
                  <p className="text-xs text-[var(--text-muted)]">How we handle your data</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
