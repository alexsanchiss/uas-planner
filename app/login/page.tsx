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
    <div className="flex flex-col bg-gray-900 min-h-0">
      <main className="flex items-center justify-center w-full py-20">
        <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-sm my-0">
          <h1 className="text-2xl font-bold text-white mb-6">
            {isSignup ? "Sign Up" : "Login"}
          </h1>
          {error && <p className="text-red-500 mb-4">{error}</p>}
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
                <div className="bg-yellow-900/30 border border-yellow-700 rounded p-2 text-yellow-200 text-xs mb-2">
                  <strong>Advice:</strong> This is a demonstration version and
                  may include bugs or not work as expected.
                </div>
                <label className="flex items-center text-xs text-gray-300">
                  <input
                    type="checkbox"
                    checked={acceptPolicy}
                    onChange={(e) => setAcceptPolicy(e.target.checked)}
                    className="accent-blue-500 mr-2 align-middle"
                    required
                  />
                  <span>
                    I accept the{" "}
                    <a
                      href="/privacy-policy"
                      className="text-blue-400 hover:text-blue-300 hover:underline"
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
          <p className="text-gray-400 text-sm mt-4 text-center">
            {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={() => setIsSignup(!isSignup)}
              className="text-blue-400 hover:underline hover:text-blue-300"
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
    <div className="flex flex-col bg-gray-900 min-h-0">
      <main className="flex items-center justify-center w-full py-20">
        <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-sm my-0 animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-24 mb-6"></div>
          <div className="space-y-4">
            <div className="h-10 bg-gray-700 rounded"></div>
            <div className="h-10 bg-gray-700 rounded"></div>
            <div className="h-10 bg-gray-700 rounded"></div>
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
