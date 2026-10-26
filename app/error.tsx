"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section
      role="alert"
      className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center"
    >
      <h1 className="text-2xl font-semibold text-fg">Algo ha salido mal</h1>
      <p className="max-w-md text-muted">
        Se ha producido un error inesperado. Puedes intentarlo de nuevo.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-brand px-5 py-2.5 font-medium text-brand-fg hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        Reintentar
      </button>
    </section>
  );
}
