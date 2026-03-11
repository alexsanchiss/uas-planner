"use client";

import React, { useEffect, useState } from "react";

export function SessionExpiredOverlay() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handleExpired = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setMessage(
        detail?.message ?? "Your session has expired. Please log in again."
      );
      setVisible(true);
    };

    window.addEventListener("auth:session-expired", handleExpired);
    return () =>
      window.removeEventListener("auth:session-expired", handleExpired);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[var(--bg-secondary)] rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
        {/* Lock icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <p className="text-[var(--text-primary)] text-base mb-6">{message}</p>

        <a
          href="/login"
          className="inline-block w-full rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          Log In
        </a>
      </div>
    </div>
  );
}
