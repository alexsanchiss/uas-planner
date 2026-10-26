"use client";

import Link from "next/link";
import { useI18n } from "./i18n";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <p className="text-5xl font-bold text-brand-text" aria-hidden="true">
        404
      </p>
      <h1 className="text-2xl font-semibold text-fg">{t.boundary.notFoundTitle}</h1>
      <p className="max-w-md text-muted">{t.boundary.notFoundBody}</p>
      <Link
        href="/"
        className="rounded-lg bg-brand px-5 py-2.5 font-medium text-brand-fg hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        {t.boundary.backHome}
      </Link>
    </section>
  );
}
