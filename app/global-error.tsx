"use client";

import "./globals.css";
import { defaultLanguage, getTranslation } from "./i18n/translations";

// Replaces the root layout (and its providers), so it brings its own <html>/<body> and cannot use
// the i18n context: it falls back to the default language. Dark theme (default tokens).
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const b = getTranslation(defaultLanguage).boundary;
  return (
    <html lang={defaultLanguage}>
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-4 text-center text-fg">
        <h1 className="text-2xl font-semibold">{b.globalErrorTitle}</h1>
        <p className="max-w-md text-muted">{b.globalErrorBody}</p>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-brand px-5 py-2.5 font-medium text-brand-fg hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
        >
          {b.retry}
        </button>
      </body>
    </html>
  );
}
