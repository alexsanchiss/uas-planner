"use client";

import { useState } from "react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
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
    <div className="flex flex-col bg-[var(--bg-primary)] min-h-0">
      <main className="flex items-center justify-center w-full py-20">
        <div className="bg-[var(--surface-primary)] p-6 rounded-lg shadow-md w-full max-w-sm">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            {t.auth.forgotPasswordTitle}
          </h1>

          {submitted ? (
            <>
              <p className="text-[var(--text-secondary)] text-sm mb-6">
                {t.auth.resetLinkSentDesc}
              </p>
              <a
                href="/login"
                className="text-[var(--color-primary)] hover:underline hover:text-[var(--color-primary-hover)] text-sm"
              >
                {t.auth.backToLogin}
              </a>
            </>
          ) : (
            <>
              <p className="text-[var(--text-secondary)] text-sm mb-6">
                {t.auth.forgotPasswordDesc}
              </p>
              {error && (
                <p className="text-[var(--status-error)] mb-4 text-sm">
                  {error}
                </p>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  type="email"
                  placeholder={t.auth.email}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t.auth.sending : t.auth.sendResetLink}
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
