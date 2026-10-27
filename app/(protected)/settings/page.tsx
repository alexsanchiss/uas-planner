"use client";

import { useTheme } from "../../hooks/useTheme";
import { useI18n, Language } from "../../i18n";
import { Settings, Sun, Moon, Mail, HelpCircle, Shield, Bell, Globe, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring";
const CARD = "rounded-xl border border-line bg-surface p-6 shadow-theme-lg";

/** Selectable option (theme, language). Selection is shown by border, tint, text AND a check icon, and exposed with aria-pressed. */
function OptionButton({
  selected,
  onSelect,
  icon: Icon,
  label,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: LucideIcon;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex items-center gap-4 rounded-lg border-2 p-4 text-left transition-colors ${FOCUS} ${
        selected ? "border-brand-ring bg-info-soft" : "border-line bg-surface-2 hover:border-line-2"
      }`}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-full ${
          selected ? "bg-brand text-brand-fg" : "bg-subtle text-fg-2"
        }`}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="flex-1">
        <p className={`font-medium ${selected ? "text-brand-text" : "text-fg"}`}>{label}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>
      {selected && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-brand-fg">
          <Check className="h-4 w-4" aria-hidden="true" />
        </div>
      )}
    </button>
  );
}

export default function SettingsPage() {
  const { theme, setTheme, isDark } = useTheme();
  const { language, setLanguage, t } = useI18n();
  const a = t.account;

  const themeOptions = [
    { value: "dark" as const, label: a.themeDark, icon: Moon, description: a.themeDarkHint },
    { value: "light" as const, label: a.themeLight, icon: Sun, description: a.themeLightHint },
  ];

  const languageOptions: { value: Language; label: string; nativeLabel: string }[] = [
    { value: "en", label: "English", nativeLabel: "English" },
    { value: "es", label: "Spanish", nativeLabel: "Español" },
  ];

  const quickLinks = [
    { href: "/contact-us", icon: Mail, label: t.nav.contactUs, hint: a.contactHint },
    { href: "/how-it-works", icon: HelpCircle, label: t.nav.howItWorks, hint: a.howItWorksHint },
    { href: "/privacy-policy", icon: Shield, label: t.nav.privacyPolicy, hint: a.privacyHint },
  ];

  return (
    <div className="w-full bg-canvas px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="mb-2">
          <h1 className="flex items-center gap-3 text-3xl font-bold text-fg">
            <Settings className="h-8 w-8" aria-hidden="true" />
            {a.settingsTitle}
          </h1>
          <p className="mt-1 text-muted">{a.settingsSubtitle}</p>
        </div>

        {/* Theme Section */}
        <section aria-labelledby="settings-appearance" className={CARD}>
          <h2 id="settings-appearance" className="mb-4 flex items-center gap-2 text-lg font-semibold text-fg">
            {isDark ? <Moon className="h-5 w-5" aria-hidden="true" /> : <Sun className="h-5 w-5" aria-hidden="true" />}
            {a.appearance}
          </h2>
          <p className="mb-4 text-sm text-muted">{a.appearanceHint}</p>

          <div className="grid gap-3">
            {themeOptions.map((option) => (
              <OptionButton
                key={option.value}
                selected={theme === option.value}
                onSelect={() => setTheme(option.value)}
                icon={option.icon}
                label={option.label}
                description={option.description}
              />
            ))}
          </div>
        </section>

        {/* Language Section */}
        <section aria-labelledby="settings-language" className={CARD}>
          <h2 id="settings-language" className="mb-4 flex items-center gap-2 text-lg font-semibold text-fg">
            <Globe className="h-5 w-5" aria-hidden="true" />
            {t.settings.language}
          </h2>
          <p className="mb-4 text-sm text-muted">{a.languageHint}</p>

          <div className="grid gap-3">
            {languageOptions.map((option) => (
              <OptionButton
                key={option.value}
                selected={language === option.value}
                onSelect={() => setLanguage(option.value)}
                icon={Globe}
                label={option.label}
                description={option.nativeLabel}
              />
            ))}
          </div>
        </section>

        {/* Notifications Section (Placeholder) */}
        <section aria-labelledby="settings-notifications" className={CARD}>
          <h2 id="settings-notifications" className="mb-4 flex items-center gap-2 text-lg font-semibold text-fg">
            <Bell className="h-5 w-5" aria-hidden="true" />
            {t.settings.notifications}
          </h2>
          <p className="mb-4 text-sm text-muted">{a.notificationsSoon}</p>
          <div className="rounded-lg border border-line bg-surface-2 p-4">
            <p className="text-center text-sm text-muted">{a.notificationsSoonDetail}</p>
          </div>
        </section>

        {/* Quick Links */}
        <section aria-labelledby="settings-links" className={CARD}>
          <h2 id="settings-links" className="mb-4 text-lg font-semibold text-fg">
            {a.quickLinks}
          </h2>
          <div className="grid gap-3">
            {quickLinks.map(({ href, icon: Icon, label, hint }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg bg-surface-2 p-3 transition-colors hover:bg-hover ${FOCUS}`}
              >
                <Icon className="h-5 w-5 text-brand-text" aria-hidden="true" />
                <div>
                  <p className="font-medium text-fg">{label}</p>
                  <p className="text-xs text-muted">{hint}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
