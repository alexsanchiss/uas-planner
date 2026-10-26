"use client";

import { useState } from "react";
import { Input } from "../components/ui/input";
import { AuthButton, AuthCard, AuthError, AuthLink } from "../components/auth/auth-card";
import { useI18n } from "../i18n";
import axios from "axios";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await axios.post("/api/auth/forgot-password", { email });
      setSubmitted(true);
    } catch {
      setError(t.auth.errorOccurredRetry);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title={t.auth.forgotPasswordTitle}
      description={submitted ? t.auth.resetLinkSentDesc : t.auth.forgotPasswordDesc}
    >
      {submitted ? (
        <p className="text-sm">
          <AuthLink href="/login">{t.auth.backToLogin}</AuthLink>
        </p>
      ) : (
        <>
          {error && <AuthError>{error}</AuthError>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              name="email"
              label={t.auth.email}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <AuthButton type="submit" pending={loading}>
              {loading ? t.auth.sending : t.auth.sendResetLink}
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
