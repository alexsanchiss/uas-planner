import { Plane, type LucideIcon } from "lucide-react";

export function ServiceMark({
  icon: Icon = Plane,
  className = "h-8 w-8",
}: {
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-brand text-brand-fg ${className}`}
    >
      <Icon className="h-1/2 w-1/2" strokeWidth={2.25} />
    </span>
  );
}

export function BrandMark({
  compact = false,
  transparent = false,
}: {
  compact?: boolean;
  transparent?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <ServiceMark className={compact ? "h-7 w-7 rounded-md" : "h-8 w-8"} />
      <span
        translate="no"
        className={`whitespace-nowrap font-bold tracking-[0.12em] ${
          compact ? "text-sm" : "text-base"
        } ${transparent ? "text-white" : "text-fg"}`}
      >
        PAUTHFLY
      </span>
    </span>
  );
}
