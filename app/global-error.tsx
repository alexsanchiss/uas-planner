"use client";

import "./globals.css";

// Replaces the root layout, so it brings its own <html>/<body>. Dark theme (default tokens).
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-4 text-center text-fg">
        <h1 className="text-2xl font-semibold">Algo ha salido mal</h1>
        <p className="max-w-md text-muted">
          La aplicación ha tenido un error grave. Puedes intentarlo de nuevo.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-brand px-5 py-2.5 font-medium text-brand-fg hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
