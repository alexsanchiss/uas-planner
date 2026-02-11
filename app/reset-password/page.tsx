"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useI18n } from "../i18n";
import axios from "axios";

function ResetPasswordContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError(t.auth.passwordsDoNotMatch);
      return;
    }

    if (newPassword.length < 8) {
      setError(t.auth.passwordMinLength);
      return;
    }

    setLoading(true);
    try {
      await axios.post("/api/auth/reset-password", {
        token,
        newPassword,
      });
      setSuccess(true);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.error || t.auth.errorOccurredRetry
        );
      } else {
        setError(t.auth.errorOccurredRetry);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex flex-col bg-[var(--bg-primary)] min-h-0">
        <main className="flex items-center justify-center w-full py-20">
          <div className="bg-[var(--surface-primary)] p-6 rounded-lg shadow-md w-full max-w-sm">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
              {t.auth.invalidLink}
            </h1>
            <p className="text-[var(--text-secondary)] text-sm mb-4">
              {t.auth.invalidResetLink}
            </p>
            <a
              href="/forgot-password"
              className="text-[var(--color-primary)] hover:underline hover:text-[var(--color-primary-hover)] text-sm"
            >
              {t.auth.requestNewResetLink}
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-[var(--bg-primary)] min-h-0">
      <main className="flex items-center justify-center w-full py-20">
        <div className="bg-[var(--surface-primary)] p-6 rounded-lg shadow-md w-full max-w-sm">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            {t.auth.resetPasswordTitle}
          </h1>

          {success ? (
            <>
              <p className="text-green-400 mb-4">
                {t.auth.passwordResetSuccessDesc}
              </p>
              <Button className="w-full" onClick={() => router.push("/login")}>
                {t.auth.goToLogin}
              </Button>
            </>
          ) : (
            <>
              <p className="text-[var(--text-secondary)] text-sm mb-6">
                {t.auth.enterNewPasswordDesc}
              </p>
              {error && (
                <p className="text-[var(--status-error)] mb-4 text-sm">
                  {error}
                </p>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  type="password"
                  placeholder={t.auth.newPassword}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <Input
                  type="password"
                  placeholder={t.auth.confirmNewPassword}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t.auth.resettingPassword : t.auth.resetPassword}
                </Button>
              </form>
              <p className="text-[var(--text-tertiary)] text-sm mt-4 text-center">
                <a
                  href="/login"
                  className="text-[var(--color-primary)] hover:underline hover:text-[var(--color-primary-hover)]"
                >
                  {t.auth.backToLogin}
                </a>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function ResetPasswordLoading() {
  return (
    <div className="flex flex-col bg-[var(--bg-primary)] min-h-0">
      <main className="flex items-center justify-center w-full py-20">
        <div className="bg-[var(--surface-primary)] p-6 rounded-lg shadow-md w-full max-w-sm animate-pulse">
          <div className="h-8 bg-[var(--bg-tertiary)] rounded w-48 mb-6"></div>
          <div className="space-y-4">
            <div className="h-10 bg-[var(--bg-tertiary)] rounded"></div>
            <div className="h-10 bg-[var(--bg-tertiary)] rounded"></div>
            <div className="h-10 bg-[var(--bg-tertiary)] rounded"></div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordLoading />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
