"use client";

import { useI18n } from "./i18n";

export default function Loading() {
  const { t } = useI18n();
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-1 items-center justify-center py-20"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-line border-t-brand motion-reduce:animate-none" />
      <span className="sr-only">{t.boundary.loading}</span>
    </div>
  );
}
