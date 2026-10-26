"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import { Input } from "../components/ui/input";
import { AuthButton, AuthCard, AuthCardSkeleton, AuthError, authLinkClass } from "../components/auth/auth-card";
import { useI18n } from "../i18n";
import axios from "axios";

const TAB_BASE =
  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring";

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
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const switchMode = (signup: boolean) => {
    if (signup === isSignup) return;
    setIsSignup(signup);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;

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

      setError("");
      setPending(true);
      try {
        await axios.post("/api/auth/signup", { 
          email, 
          password,
          confirmPassword,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          phone: phone || undefined,
        });
        // After signup, redirect to verification page (stays pending while navigating)
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- axios-like error shape not typed
      } catch (err: any) {
        setPending(false);
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
      setError("");
      setPending(true);
      const result = await login(email, password);
      if (result === true) {
        // Check for redirect query param, otherwise go to home
        const redirectUrl = searchParams?.get('redirect');
        if (redirectUrl) {
          router.push(decodeURIComponent(redirectUrl));
        } else {
          router.push("/launch");
        }
      } else if (typeof result === 'object' && result.requiresVerification) {
        router.push(`/verify-email?email=${encodeURIComponent(result.email)}`);
      } else {
        setPending(false);
        setError(t.auth.invalidCredentials);
      }
    }
  };

  const mode = isSignup ? "signup" : "login";
  const optional = t.authForm.optional;
  const [policyBefore, policyAfter] = t.auth.acceptPrivacyPolicy.split('{link}');

  return (
    <AuthCard title={isSignup ? t.auth.signUp : t.auth.login} hideTitle>
      {/* Login / sign-up share this URL: two tabs, no query parameter */}
      <div
        role="tablist"
        aria-label={t.authForm.tabsLabel}
        className="mb-6 flex gap-1 rounded-lg bg-subtle p-1"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            switchMode(e.key === "ArrowRight");
            document.getElementById(e.key === "ArrowRight" ? "auth-tab-signup" : "auth-tab-login")?.focus();
          }
        }}
      >
        <button
          type="button"
          role="tab"
          id="auth-tab-login"
          aria-selected={!isSignup}
          aria-controls="auth-panel"
          tabIndex={isSignup ? -1 : 0}
          onClick={() => switchMode(false)}
          className={`${TAB_BASE} ${!isSignup ? "bg-surface text-fg shadow-theme-sm" : "text-fg-2 hover:text-fg"}`}
        >
          {t.auth.login}
        </button>
        <button
          type="button"
          role="tab"
          id="auth-tab-signup"
          aria-selected={isSignup}
          aria-controls="auth-panel"
          tabIndex={isSignup ? 0 : -1}
          onClick={() => switchMode(true)}
          className={`${TAB_BASE} ${isSignup ? "bg-surface text-fg shadow-theme-sm" : "text-fg-2 hover:text-fg"}`}
        >
          {t.auth.signUp}
        </button>
      </div>

      <div role="tabpanel" id="auth-panel" aria-labelledby={`auth-tab-${mode}`}>
        {error && <AuthError>{error}</AuthError>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            name="email"
            label={t.auth.email}
            autoComplete={isSignup ? "email" : "username"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            name="password"
            label={t.auth.password}
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {isSignup && (
            <>
              <Input
                type="password"
                name="confirmPassword"
                label={t.auth.confirmPassword}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <Input
                type="text"
                name="firstName"
                label={`${t.authForm.firstName} ${optional}`}
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <Input
                type="text"
                name="lastName"
                label={`${t.authForm.lastName} ${optional}`}
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
              <Input
                type="tel"
                name="phone"
                label={`${t.authForm.phone} ${optional}`}
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <div className="mb-2 rounded border border-warning-line bg-warning-soft p-2 text-xs text-warning-text">
                <strong>{t.auth.advice}:</strong> {t.auth.demoDisclaimer}
              </div>
              <label className="flex items-center text-xs text-fg-2">
                <input
                  type="checkbox"
                  checked={acceptPolicy}
                  onChange={(e) => setAcceptPolicy(e.target.checked)}
                  className="mr-2 align-middle accent-brand"
                  required
                />
                <span>
                  {policyBefore}
                  <Link
                    href="/privacy-policy"
                    className={authLinkClass}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${t.nav.privacyPolicy} (${t.authForm.showPolicy})`}
                  >
                    {t.nav.privacyPolicy}
                  </Link>
                  {policyAfter}
                </span>
              </label>
            </>
          )}
          <AuthButton type="submit" pending={pending}>
            {pending ? t.authForm.submitting : isSignup ? t.auth.signUp : t.auth.login}
          </AuthButton>
        </form>
        {!isSignup && (
          <p className="mt-4 text-center text-sm">
            <Link href="/forgot-password" className={authLinkClass}>
              {t.auth.forgotPassword}
            </Link>
          </p>
        )}
      </div>
    </AuthCard>
  );
}

function LoginLoading() {
  const { t } = useI18n();
  return <AuthCardSkeleton label={t.common.loading} />;
}

export default function AuthPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginContent />
    </Suspense>
  );
}
