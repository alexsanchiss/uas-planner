import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface InteractiveHoverButtonProps {
  text?: string;
  href?: string;
  className?: string;
}

/** Primary call to action. A real link (prefetch, open in new tab, announced as a link); hover motion is CSS only. */
export function InteractiveHoverButton({
  text = "Enter Platform",
  href = "/launch",
  className,
}: InteractiveHoverButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center justify-center gap-2 rounded-full bg-brand px-8 py-3.5 text-lg font-semibold text-brand-fg shadow-theme-md transition-colors duration-300 hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        className
      )}
    >
      {text}
      <ArrowRight
        className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
        aria-hidden="true"
      />
    </Link>
  );
}
