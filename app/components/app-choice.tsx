import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ServiceMark } from "./brand-mark";

interface AppChoiceProps {
  name: string;
  description: string;
  icon: LucideIcon;
  href: string;
}

/** Service card on /launch (always-dark stage, see launch/page.tsx). The call to action is a real link. */
export function AppChoice({ name, description, icon, href }: AppChoiceProps) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-theme-md transition-transform duration-200 hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100">
      <div className="flex h-60 items-center justify-center border-b border-line bg-surface-2">
        <ServiceMark icon={icon} className="h-24 w-24 rounded-3xl" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h2 className="mb-2 text-xl font-bold text-fg">{name}</h2>
        <p className="mb-4 flex-1 text-fg-2">{description}</p>
        <Link
          href={href}
          aria-label={`Launch ${name}`}
          className="inline-flex w-full items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          Launch
        </Link>
      </div>
    </div>
  );
}
