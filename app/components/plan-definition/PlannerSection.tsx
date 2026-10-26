import React from "react";
import { ChevronDown } from "lucide-react";

/**
 * Collapsible sidebar section on the native <details>/<summary>: keyboard (Enter/Space) and screen-reader
 * support for free, and the content stays mounted while closed so inner state is not lost.
 */
export default function PlannerSection({
  title,
  badge,
  defaultOpen = true,
  children,
}: {
  title: string;
  /** Short text shown next to the chevron (e.g. a count). */
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group border-b border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-fg hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="flex items-center gap-2">
          {badge}
          <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}
