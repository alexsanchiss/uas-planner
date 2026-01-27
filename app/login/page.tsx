"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import axios from "axios";

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
          "You must accept the Privacy Policy and DEMO disclaimer to sign up."
        );
        return;
      }
      try {
        await axios.post("/api/auth/signup", { email, password });
        setIsSignup(false); // Return to login screen
      } catch (error) {
        setError("Error creating account");
      }
    } else {
      // Login
      const success = await login(email, password);
      if (success) {
        // Check for redirect query param, otherwise go to home
        const redirectUrl = searchParams?.get('redirect');
        if (redirectUrl) {
          // Decode and navigate to the original destination
          router.push(decodeURIComponent(redirectUrl));
        } else {
          router.push("/");
        }
      } else {
        setError("Invalid email or password");
      }
    }
  };

  return (
    <div className="flex flex-col bg-[var(--bg-primary)] min-h-0">
      <main className="flex items-center justify-center w-full py-20">
        <div className="bg-[var(--surface-primary)] p-6 rounded-lg shadow-md w-full max-w-sm my-0">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
            {isSignup ? "Sign Up" : "Login"}
          </h1>
          {error && <p className="text-[var(--status-error)] mb-4">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {isSignup && (
              <>
                <div className="bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] rounded p-2 text-[var(--status-warning-text)] text-xs mb-2">
                  <strong>Advice:</strong> This is a demonstration version and
                  may include bugs or not work as expected.
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
                    I accept the{" "}
                    <a
                      href="/privacy-policy"
                      className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] hover:underline"
                      target="_blank"
                    >
                      Privacy Policy
                    </a>{" "}
                    and understand this is a DEMO version
                  </span>
                </label>
              </>
            )}
            <Button type="submit" className="w-full">
              {isSignup ? "Sign Up" : "Login"}
            </Button>
          </form>
          <p className="text-[var(--text-tertiary)] text-sm mt-4 text-center">
            {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={() => setIsSignup(!isSignup)}
              className="text-[var(--color-primary)] hover:underline hover:text-[var(--color-primary-hover)]"
            >
              {isSignup ? "Login" : "Sign Up"}
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
