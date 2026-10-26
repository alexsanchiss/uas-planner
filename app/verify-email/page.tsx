"use client";

import { useState, useEffect, Suspense, useRef } from "react";
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

type VerifyState = "idle" | "verifying" | "success" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useI18n();
  const token = searchParams?.get("token");
  const initialEmail = searchParams?.get("email") || "";

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [state, setState] = useState<VerifyState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [resending, setResending] = useState(false);
  const hasVerifiedRef = useRef(false);

  // Auto-verify if token is present in URL
  useEffect(() => {
    if (token && !hasVerifiedRef.current) {
      hasVerifiedRef.current = true;
      setState("verifying");
      axios
        .post("/api/auth/verify-email", { token })
        .then(() => setState("success"))
        .catch((err) => {
          setState("error");
          setErrorMessage(
            err.response?.data?.error || t.auth.verificationLinkExpired
          );
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !code) return;

    setState("verifying");
    setErrorMessage("");
    try {
      await axios.post("/api/auth/verify-email", { email, code });
      setState("success");
    } catch (err) {
      setState("error");
      if (axios.isAxiosError(err)) {
        setErrorMessage(err.response?.data?.error || t.auth.invalidOrExpiredCode);
      } else {
        setErrorMessage(t.errors.generic);
      }
    }
  };

  const handleResend = async () => {
    if (!email || resending) return;
    setResending(true);
    setResendMessage("");
    try {
      const resp = await axios.post("/api/auth/resend-verification", { email });
      setResendMessage(resp.data.message || t.auth.codeSent);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 429) {
        setResendMessage(err.response.data.error || t.auth.waitBeforeResend);
      } else {
        setResendMessage(t.auth.errorSendingVerification);
      }
    } finally {
      setResending(false);
    }
  };

  // Token auto-verify: show verifying/success/error state
  if (token) {
    return (
      <AuthCard title={t.auth.verifyEmail}>
        {state === "verifying" && (
          <p role="status" className="text-fg-2">{t.auth.verifying}</p>
        )}
        {state === "success" && (
          <>
            <AuthSuccess>{t.auth.emailVerifiedSuccess}</AuthSuccess>
            <AuthButton onClick={() => router.push("/login")}>{t.auth.goToLogin}</AuthButton>
          </>
        )}
        {state === "error" && (
          <>
            <AuthError>{errorMessage}</AuthError>
            <AuthButton variant="secondary" onClick={() => router.push("/verify-email")}>
              {t.auth.enterCodeManually}
            </AuthButton>
          </>
        )}
      </AuthCard>
    );
  }

  // Code entry form
  return (
    <AuthCard title={t.auth.verifyYourEmail} description={t.auth.enterVerificationCode}>
      {state === "success" ? (
        <>
          <AuthSuccess>{t.auth.emailVerifiedSuccess}</AuthSuccess>
          <AuthButton onClick={() => router.push("/login")}>{t.auth.goToLogin}</AuthButton>
        </>
      ) : (
        <>
          {state === "error" && <AuthError>{errorMessage}</AuthError>}

          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <Input
              type="email"
              name="email"
              label={t.auth.email}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="text"
              name="code"
              label={t.authForm.verificationCode}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder={t.auth.verificationCodePlaceholder}
              value={code}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(val);
              }}
              required
            />
            <AuthButton type="submit" pending={state === "verifying"}>
              {state === "verifying" ? t.auth.verifying : t.auth.verifyEmail}
            </AuthButton>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || !email}
              className="rounded-sm text-sm text-brand-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resending ? t.auth.resending : t.auth.resendCode}
            </button>
            <p role="status" className="mt-2 text-xs text-fg-2">
              {resendMessage}
            </p>
          </div>

          <p className="mt-4 text-center text-sm">
            <AuthLink href="/login">{t.auth.backToLogin}</AuthLink>
          </p>
        </>
      )}
    </AuthCard>
  );
}

function VerifyEmailLoading() {
  const { t } = useI18n();
  return <AuthCardSkeleton label={t.common.loading} />;
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailLoading />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
