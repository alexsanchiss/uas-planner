"use client";

import { useState } from "react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import axios from "axios";

export default function ForgotPasswordPage() {
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
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col bg-[var(--bg-primary)] min-h-0">
      <main className="flex items-center justify-center w-full py-20">
        <div className="bg-[var(--surface-primary)] p-6 rounded-lg shadow-md w-full max-w-sm">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            Forgot Password
          </h1>

          {submitted ? (
            <>
              <p className="text-[var(--text-secondary)] text-sm mb-6">
                If an account with that email exists, we&apos;ve sent a password
                reset link. Please check your inbox.
              </p>
              <a
                href="/login"
                className="text-[var(--color-primary)] hover:underline hover:text-[var(--color-primary-hover)] text-sm"
              >
                Back to Login
              </a>
            </>
          ) : (
            <>
              <p className="text-[var(--text-secondary)] text-sm mb-6">
                Enter your email address and we&apos;ll send you a link to reset
                your password.
              </p>
              {error && (
                <p className="text-[var(--status-error)] mb-4 text-sm">
                  {error}
                </p>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
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
