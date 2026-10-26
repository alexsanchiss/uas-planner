import Link from "next/link";

export default function NotFound() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <p className="text-5xl font-bold text-brand-text">404</p>
      <h1 className="text-2xl font-semibold text-fg">Página no encontrada</h1>
      <p className="max-w-md text-muted">
        La dirección no existe o se ha movido.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-brand px-5 py-2.5 font-medium text-brand-fg hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        Volver al inicio
      </Link>
    </section>
  );
}
