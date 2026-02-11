"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import axios from "axios";

function ResetPasswordContent() {
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
      setError("Passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
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
          err.response?.data?.error || "An error occurred. Please try again."
        );
      } else {
        setError("An error occurred. Please try again.");
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
              Invalid Link
            </h1>
            <p className="text-[var(--text-secondary)] text-sm mb-4">
              This password reset link is invalid or has expired.
            </p>
            <a
              href="/forgot-password"
              className="text-[var(--color-primary)] hover:underline hover:text-[var(--color-primary-hover)] text-sm"
            >
              Request a new reset link
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
            Reset Password
          </h1>

          {success ? (
            <>
              <p className="text-green-400 mb-4">
                Your password has been reset successfully!
              </p>
              <Button className="w-full" onClick={() => router.push("/login")}>
                Go to Login
              </Button>
            </>
          ) : (
            <>
              <p className="text-[var(--text-secondary)] text-sm mb-6">
                Enter your new password below.
              </p>
              {error && (
                <p className="text-[var(--status-error)] mb-4 text-sm">
                  {error}
                </p>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <Input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Resetting..." : "Reset Password"}
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
