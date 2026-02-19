"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { ProtectedRoute } from "../components/auth/protected-route";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { User, Mail, Calendar, Shield, Phone } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();
  const toast = useToast();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileLoaded, setProfileLoaded] = useState(false);
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
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveProfile = async () => {
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
      toast.success("Profile updated successfully");
      window.dispatchEvent(new Event("auth:changed"));
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[var(--bg-primary)] py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">Profile</h1>
            <p className="text-[var(--text-muted)] mt-1">Your account information</p>
          </div>

          {/* Profile Card */}
          <div className="bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-xl p-6 shadow-lg">
            {/* Avatar and Name */}
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[var(--border-primary)]">
              <div className="w-20 h-20 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white text-2xl font-bold">
                {user?.firstName?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                  {user?.firstName && user?.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user?.username || "User"}
                </h2>
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--status-success-bg)] text-[var(--status-success-text)] border border-[var(--status-success-border)]">
                  <Shield className="w-3 h-3" />
                  Active Account
                </span>
              </div>
            </div>

            {/* Editable Profile Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">First Name</label>
                <Input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter your first name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Last Name</label>
                <Input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter your last name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Phone</label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter your phone number"
                />
              </div>

              <div>
                <Button onClick={handleSaveProfile} disabled={saving || !profileLoaded}>
                  {saving ? "Saving..." : "Save Profile"}
                </Button>
              </div>

              {/* Read-only fields */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]">
                <div className="w-10 h-10 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center">
                  <Mail className="w-5 h-5 text-[var(--color-primary)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Email</p>
                  <p className="text-[var(--text-primary)] font-medium">{user?.email || "Not set"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]">
                <div className="w-10 h-10 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-[var(--color-primary)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Account ID</p>
                  <p className="text-[var(--text-primary)] font-medium">#{user?.id || "—"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
