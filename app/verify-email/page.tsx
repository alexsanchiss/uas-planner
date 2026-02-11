"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import axios from "axios";

type VerifyState = "idle" | "verifying" | "success" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
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
            err.response?.data?.error || "Verification failed. The link may have expired."
          );
        });
    }
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
        setErrorMessage(err.response?.data?.error || "Invalid or expired code.");
      } else {
        setErrorMessage("An error occurred.");
      }
    }
  };

  const handleResend = async () => {
    if (!email || resending) return;
    setResending(true);
    setResendMessage("");
    try {
      const resp = await axios.post("/api/auth/resend-verification", { email });
      setResendMessage(resp.data.message || "A new code has been sent.");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 429) {
        setResendMessage(err.response.data.error || "Please wait before requesting a new code.");
      } else {
        setResendMessage("Error sending verification email.");
      }
    } finally {
      setResending(false);
    }
  };

  // Token auto-verify: show verifying/success/error state
  if (token) {
    return (
      <div className="flex flex-col bg-[var(--bg-primary)] min-h-0">
        <main className="flex items-center justify-center w-full py-20">
          <div className="bg-[var(--surface-primary)] p-6 rounded-lg shadow-md w-full max-w-sm">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
              Email Verification
            </h1>
            {state === "verifying" && (
              <p className="text-[var(--text-secondary)]">Verifying your email...</p>
            )}
            {state === "success" && (
              <>
                <p className="text-green-400 mb-4">
                  Your email has been verified successfully!
                </p>
                <Button className="w-full" onClick={() => router.push("/login")}>
                  Go to Login
                </Button>
              </>
            )}
            {state === "error" && (
              <>
                <p className="text-[var(--status-error)] mb-4">{errorMessage}</p>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => router.push("/verify-email")}
                >
                  Enter code manually
                </Button>
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  // Code entry form
  return (
    <div className="flex flex-col bg-[var(--bg-primary)] min-h-0">
      <main className="flex items-center justify-center w-full py-20">
        <div className="bg-[var(--surface-primary)] p-6 rounded-lg shadow-md w-full max-w-sm">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            Verify Your Email
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mb-6">
            Enter the 6-digit code sent to your email address.
          </p>

          {state === "success" ? (
            <>
              <p className="text-green-400 mb-4">
                Your email has been verified successfully!
              </p>
              <Button className="w-full" onClick={() => router.push("/login")}>
                Go to Login
              </Button>
            </>
          ) : (
            <>
              {state === "error" && (
                <p className="text-[var(--status-error)] mb-4">{errorMessage}</p>
              )}

              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="6-digit code"
                  value={code}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setCode(val);
                  }}
                  required
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={state === "verifying"}
                >
                  {state === "verifying" ? "Verifying..." : "Verify Email"}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={handleResend}
                  disabled={resending || !email}
                  className="text-[var(--color-primary)] hover:underline hover:text-[var(--color-primary-hover)] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resending ? "Sending..." : "Resend verification code"}
                </button>
                {resendMessage && (
                  <p className="text-[var(--text-secondary)] text-xs mt-2">
                    {resendMessage}
                  </p>
                )}
              </div>

              <p className="text-[var(--text-tertiary)] text-sm mt-4 text-center">
                <a
                  href="/login"
                  className="text-[var(--color-primary)] hover:underline hover:text-[var(--color-primary-hover)]"
                >
                  Back to Login
                </a>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function VerifyEmailLoading() {
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

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailLoading />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
