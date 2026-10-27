"use client";

import { AppChoice } from "../components/app-choice";
import Link from "next/link";
import { HelpCircle, Map, Plane, ShieldCheck } from "lucide-react";
import dynamic from "next/dynamic";

const ShaderBackground = dynamic(
  () => import("@/components/ui/animated-shader-background"),
  { ssr: false }
);

// Listed in flow order: define, authorize, activate.
const apps = [
  {
    name: "Plan Definition",
    href: "/plan-definition",
    description:
      "Design your flight mission on an interactive map. Set waypoints, configure scan patterns, and define your operational volume.",
    icon: Map,
  },
  {
    name: "Plan Authorization",
    href: "/plan-authorization",
    description:
      "Submit your flight plan for airspace approval. Track its status in real time and receive authorization to operate.",
    icon: ShieldCheck,
  },
  {
    name: "Plan Activation",
    href: "/plan-activation",
    description:
      "Go live. Activate your authorized flight plan inside its scheduled window and get your take-off clearance.",
    icon: Plane,
  },
];

/** Always-dark stage over the shader: `data-theme="dark"` re-scopes the dark tokens, so tokens stay readable in a light app theme. */
export default function LaunchPage() {
  return (
    <div data-theme="dark" className="relative min-h-screen bg-canvas text-fg">
      {/* Shader background */}
      <div className="fixed inset-0 z-0" aria-hidden="true">
        <ShaderBackground />
      </div>
      <div className="fixed inset-0 z-[1] bg-black/40" aria-hidden="true" />

      {/* Help Button */}
      <Link
        href="/how-it-works"
        aria-label="Need help? How it works"
        title="Need help?"
        className="fixed right-8 top-24 z-40 flex items-center gap-2 rounded-full bg-brand p-3 text-brand-fg shadow-theme-lg transition-colors duration-200 hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <HelpCircle className="h-6 w-6" aria-hidden="true" />
      </Link>

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Page heading */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">
            Choose Your Service
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-lg text-fg-2">
            From mission design to live activation, select where you want to start.
          </p>
        </div>

        {/* App Choices */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <AppChoice key={app.name} {...app} />
          ))}
        </div>
      </div>
    </div>
  );
}
