"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "../components/ui/input";
import {
  AuthButton,
  AuthCard,
  AuthCardSkeleton,
  AuthError,
  AuthLink,
  AuthSuccess,
} from "../components/auth/auth-card";
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
      <AuthCard title={t.auth.invalidLink} description={t.auth.invalidResetLink}>
        <p className="text-sm">
          <AuthLink href="/forgot-password">{t.auth.requestNewResetLink}</AuthLink>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t.auth.resetPasswordTitle}
      description={success ? undefined : t.auth.enterNewPasswordDesc}
    >
      {success ? (
        <>
          <AuthSuccess>{t.auth.passwordResetSuccessDesc}</AuthSuccess>
          <AuthButton onClick={() => router.push("/login")}>{t.auth.goToLogin}</AuthButton>
        </>
      ) : (
        <>
          {error && <AuthError>{error}</AuthError>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              name="newPassword"
              label={t.auth.newPassword}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
            <Input
              type="password"
              name="confirmPassword"
              label={t.auth.confirmNewPassword}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
            <AuthButton type="submit" pending={loading}>
              {loading ? t.auth.resettingPassword : t.auth.resetPassword}
            </AuthButton>
          </form>
          <p className="mt-4 text-center text-sm">
            <AuthLink href="/login">{t.auth.backToLogin}</AuthLink>
          </p>
        </>
      )}
    </AuthCard>
  );
}

function ResetPasswordLoading() {
  const { t } = useI18n();
  return <AuthCardSkeleton label={t.common.loading} />;
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordLoading />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
