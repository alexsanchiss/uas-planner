"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useI18n } from "../i18n";
import axios from "axios";

function LoginContent() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [acceptPolicy, setAcceptPolicy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSignup) {
      // Sign Up
      if (!acceptPolicy) {
        setError(
          t.auth.acceptPolicyRequired
        );
        return;
      }
      
      // Validate passwords match
      if (password !== confirmPassword) {
        setError(t.auth.passwordsDoNotMatch);
        return;
      }
      
      try {
        const response = await axios.post("/api/auth/signup", { 
          email, 
          password,
          confirmPassword,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          phone: phone || undefined,
        });
        // After signup, redirect to verification page
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      } catch (err: any) {
        // Handle validation errors from API
        if (err.response?.data?.error) {
          const errorMessage = err.response.data.error;
          
          // Check for specific error messages
          if (errorMessage.includes('domain')) {
            setError(t.auth.invalidEmailDomain);
          } else if (errorMessage.includes('at least 8 characters')) {
            setError(t.auth.passwordMinLength);
          } else if (errorMessage.includes('do not match')) {
            setError(t.auth.passwordsDoNotMatch);
          } else if (errorMessage.includes('email')) {
            setError(errorMessage);
          } else {
            setError(errorMessage);
          }
        } else {
          setError(t.auth.errorCreatingAccount);
        }
      }
    } else {
      // Login
      const result = await login(email, password);
      if (result === true) {
        // Check for redirect query param, otherwise go to home
        const redirectUrl = searchParams?.get('redirect');
        if (redirectUrl) {
          router.push(decodeURIComponent(redirectUrl));
        } else {
          router.push("/");
        }
      } else if (typeof result === 'object' && result.requiresVerification) {
        router.push(`/verify-email?email=${encodeURIComponent(result.email)}`);
      } else {
        setError(t.auth.invalidCredentials);
      }
    }
  };

  return (
    <div className="flex flex-col bg-[var(--bg-primary)] min-h-0">
      <main className="flex items-center justify-center w-full py-20">
        <div className="bg-[var(--surface-primary)] p-6 rounded-lg shadow-md w-full max-w-sm my-0">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
            {isSignup ? t.auth.signUp : t.auth.login}
          </h1>
          {error && <p className="text-[var(--status-error)] mb-4">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder={t.auth.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder={t.auth.password}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {isSignup && (
              <Input
                type="password"
                placeholder={t.auth.confirmPassword}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            )}
            {isSignup && (
              <>
                <Input
                  type="text"
                  placeholder="First Name (optional)"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <Input
                  type="text"
                  placeholder="Last Name (optional)"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
                <Input
                  type="tel"
                  placeholder="Phone (optional)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </>
            )}
            {isSignup && (
              <>
                <div className="bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] rounded p-2 text-[var(--status-warning-text)] text-xs mb-2">
                  <strong>{t.auth.advice}:</strong> {t.auth.demoDisclaimer}
                </div>
                <label className="flex items-center text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={acceptPolicy}
                    onChange={(e) => setAcceptPolicy(e.target.checked)}
                    className="accent-[var(--color-primary)] mr-2 align-middle"
                    required
                  />
                  <span>
                    {t.auth.acceptPrivacyPolicy.split('{link}')[0]}
                    <a
                      href="/privacy-policy"
                      className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] hover:underline"
                      target="_blank"
                    >
                      {t.nav.privacyPolicy}
                    </a>
                    {t.auth.acceptPrivacyPolicy.split('{link}')[1]}
                  </span>
                </label>
              </>
            )}
            <Button type="submit" className="w-full">
              {isSignup ? t.auth.signUp : t.auth.login}
            </Button>
          </form>
          {!isSignup && (
            <p className="text-sm mt-3 text-center">
              <a
                href="/forgot-password"
                className="text-[var(--color-primary)] hover:underline hover:text-[var(--color-primary-hover)]"
              >
                {t.auth.forgotPassword}
              </a>
            </p>
          )}
          <p className="text-[var(--text-tertiary)] text-sm mt-4 text-center">
            {isSignup ? t.auth.alreadyHaveAccount : t.auth.dontHaveAccount}{" "}
            <button
              onClick={() => setIsSignup(!isSignup)}
              className="text-[var(--color-primary)] hover:underline hover:text-[var(--color-primary-hover)]"
            >
              {isSignup ? t.auth.login : t.auth.signUp}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}

function LoginLoading() {
  return (
    <div className="flex flex-col bg-[var(--bg-primary)] min-h-0">
      <main className="flex items-center justify-center w-full py-20">
        <div className="bg-[var(--surface-primary)] p-6 rounded-lg shadow-md w-full max-w-sm my-0 animate-pulse">
          <div className="h-8 bg-[var(--bg-tertiary)] rounded w-24 mb-6"></div>
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

export default function AuthPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginContent />
    </Suspense>
  );
}
