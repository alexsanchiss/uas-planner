"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { useI18n } from "../../i18n";
import { Input } from "../../components/ui/input";
import { AuthButton } from "../../components/auth/auth-card";
import { Mail, Calendar, Shield } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useI18n();
  const a = t.account;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) return;
    fetch("/api/user/profile", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setFirstName(data.firstName || "");
          setLastName(data.lastName || "");
          setPhone(data.phone || "");
          setProfileLoaded(true);
        } else {
          setLoadFailed(true);
        }
      })
      .catch(() => setLoadFailed(true));
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("authToken");
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ firstName, lastName, phone }),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      toast.success(a.saved);
      window.dispatchEvent(new Event("auth:changed"));
    } catch {
      toast.error(a.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full bg-canvas px-4 py-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-fg">{a.profileTitle}</h1>
          <p className="mt-1 text-muted">{a.profileSubtitle}</p>
        </div>

        {/* Profile Card */}
        <div className="rounded-xl border border-line bg-surface p-6 shadow-theme-lg">
          {/* Avatar and Name */}
          <div className="mb-6 flex items-center gap-4 border-b border-line pb-6">
            <div
              aria-hidden="true"
              className="flex h-20 w-20 items-center justify-center rounded-full bg-brand text-2xl font-bold text-brand-fg"
            >
              {user?.firstName?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-fg">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.username || a.userFallback}
              </h2>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-success-line bg-success-soft px-2 py-0.5 text-xs font-medium text-success-text">
                <Shield className="h-3 w-3" aria-hidden="true" />
                {a.activeAccount}
              </span>
            </div>
          </div>

          {loadFailed && (
            <p role="alert" className="mb-4 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger-text">
              {a.loadFailed}
            </p>
          )}

          {/* Editable Profile Fields */}
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <Input
              type="text"
              name="firstName"
              label={a.firstName}
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder={a.firstNamePlaceholder}
            />
            <Input
              type="text"
              name="lastName"
              label={a.lastName}
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder={a.lastNamePlaceholder}
            />
            <Input
              type="tel"
              name="phone"
              label={a.phone}
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={a.phonePlaceholder}
            />

            <div className="sm:w-48">
              <AuthButton type="submit" pending={saving} disabled={!profileLoaded}>
                {saving ? a.saving : a.save}
              </AuthButton>
            </div>
          </form>

          {/* Read-only fields */}
          <dl className="mt-4 space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-surface-2 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-info-soft">
                <Mail className="h-5 w-5 text-brand-text" aria-hidden="true" />
              </div>
              <div>
                <dt className="text-xs text-muted">{a.email}</dt>
                <dd className="font-medium text-fg">{user?.email || a.notSet}</dd>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg bg-surface-2 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-info-soft">
                <Calendar className="h-5 w-5 text-brand-text" aria-hidden="true" />
              </div>
              <div>
                <dt className="text-xs text-muted">{a.accountId}</dt>
                <dd className="font-medium text-fg">#{user?.id || "-"}</dd>
              </div>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
