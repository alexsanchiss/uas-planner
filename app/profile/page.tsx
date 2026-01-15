"use client";

import { useAuth } from "../hooks/useAuth";
import { ProtectedRoute } from "../components/auth/protected-route";
import { User, Mail, Calendar, Shield } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();

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
                {user?.username?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                  {user?.username || "User"}
                </h2>
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--status-success-bg)] text-[var(--status-success-text)] border border-[var(--status-success-border)]">
                  <Shield className="w-3 h-3" />
                  Active Account
                </span>
              </div>
            </div>

            {/* Account Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]">
                <div className="w-10 h-10 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center">
                  <User className="w-5 h-5 text-[var(--color-primary)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Username</p>
                  <p className="text-[var(--text-primary)] font-medium">{user?.username || "Not set"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]">
                <div className="w-10 h-10 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center">
                  <Mail className="w-5 h-5 text-[var(--color-primary)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Email</p>
                  <p className="text-[var(--text-primary)] font-medium">{user?.username || "Not set"}</p>
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

            {/* Actions */}
            <div className="mt-6 pt-6 border-t border-[var(--border-primary)]">
              <p className="text-sm text-[var(--text-muted)] mb-4">
                Account management features coming soon. Contact support for assistance.
              </p>
              <a
                href="/contact-us"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium transition-colors"
              >
                Contact Support
              </a>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
