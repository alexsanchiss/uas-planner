"use client";

import dynamic from "next/dynamic";
import { Map, ShieldCheck, Rocket, Plane, Radar, FileStack } from "lucide-react";
import { InteractiveHoverButton } from "./components/ui/interactive-hover-button";
import { ContainerScroll } from "./components/ui/container-scroll-animation";
import { EvervaultCard } from "./components/ui/evervault-card";
import { Gallery4 } from "./components/ui/gallery4";
import { ServiceMark } from "./components/brand-mark";

const ShaderBackground = dynamic(
  () => import("@/components/ui/animated-shader-background"),
  { ssr: false }
);

// Local icons instead of remote photos: no third-party requests, works behind restrictive networks.
const galleryItems = [
  {
    id: "1",
    title: "Interactive Map Planning",
    description:
      "Design complex flight missions with our drag-and-drop map interface. Set waypoints, define altitudes, and visualize your entire operation before takeoff.",
    icon: Map,
  },
  {
    id: "2",
    title: "Real-time Authorization",
    description:
      "Submit your flight plan and receive airspace clearance in minutes. Our automated pipeline ensures regulatory compliance without the paperwork.",
    icon: ShieldCheck,
  },
  {
    id: "3",
    title: "Live Flight Monitoring",
    description:
      "Track your active flights with real-time telemetry and 3D trajectory visualization. Full situational awareness from launch to landing.",
    icon: Plane,
  },
  {
    id: "4",
    title: "Geoawareness Integration",
    description:
      "Stay informed about restricted airspace, NOTAMs, and dynamic geozones. Automatic alerts keep your operations safe and compliant.",
    icon: Radar,
  },
  {
    id: "5",
    title: "Multi-format Support",
    description:
      "Import and export flight plans in multiple industry formats. Seamless interoperability with your existing ground control software.",
    icon: FileStack,
  },
];

const features = [
  {
    icon: Map,
    label: "Plan",
    title: "Plan Definition",
    description:
      "Design your mission on an interactive map. Set waypoints, altitudes, and flight corridors with precision tools built for professionals.",
  },
  {
    icon: ShieldCheck,
    label: "Auth",
    title: "Plan Authorization",
    description:
      "Submit your operational plan and receive automated airspace clearance. Regulatory compliance handled in seconds, not days.",
  },
  {
    icon: Rocket,
    label: "Fly",
    title: "Plan Activation",
    description:
      "Activate your authorized flight when its scheduled time arrives. Read the FAS terms, confirm, and get your take-off clearance.",
  },
];

const steps = [
  { icon: Map, label: "Plan" },
  { icon: ShieldCheck, label: "Authorize" },
  { icon: Rocket, label: "Fly" },
];

// Fade-in on load. The `!` utilities keep the text visible when the user prefers reduced motion.
const FADE_IN = "splash-fade-in-up motion-reduce:!animate-none motion-reduce:!opacity-100";

/**
 * Landing is an always-dark stage over the shader: `data-theme="dark"` re-scopes the dark tokens here,
 * so the page uses the same semantic tokens as the rest of the app and stays readable in a light app theme.
 */
export default function LandingPage() {
  return (
    <div data-theme="dark" className="relative min-h-screen bg-canvas text-fg">
      {/* Fixed shader background for entire page */}
      <div className="fixed inset-0 z-0" aria-hidden="true">
        <ShaderBackground />
      </div>
      <div className="fixed inset-0 z-[1] bg-black/50" aria-hidden="true" />

      {/* Scrollable content */}
      <div className="relative z-10">
        {/* Hero */}
        <section className="flex min-h-screen items-center justify-center">
          <div className="flex max-w-2xl flex-col items-center px-4 text-center">
            <ServiceMark className="mb-4 h-12 w-12 rounded-xl" />
            <h1
              className={`text-6xl font-extrabold tracking-tight text-fg sm:text-7xl md:text-8xl ${FADE_IN}`}
              style={{ animationDelay: "0.2s" }}
            >
              <span translate="no">PAUTHFLY</span>
            </h1>
            <p
              className={`mt-4 text-lg font-light tracking-wide text-fg-2 sm:text-xl md:text-2xl ${FADE_IN}`}
              style={{ animationDelay: "0.5s" }}
            >
              Plan. Authorize. Fly.
            </p>
            <p
              className={`mt-6 text-sm leading-relaxed text-fg-2 sm:text-base ${FADE_IN}`}
              style={{ animationDelay: "0.65s" }}
            >
              The all-in-one UAS flight management platform. Define your mission,
              get airspace authorization, and activate your flight plan.
            </p>
            <div className={`mt-10 ${FADE_IN}`} style={{ animationDelay: "0.8s" }}>
              <InteractiveHoverButton text="Enter Platform" href="/launch" />
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 sm:py-32">
          <div className="container mx-auto px-4">
            <div className="rounded-2xl border border-line bg-surface p-8 sm:p-12">
              <ContainerScroll
                titleComponent={
                  <div className="mx-auto max-w-3xl">
                    <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-brand-text sm:text-base">
                      How It Works
                    </p>
                    <h2 className="text-3xl font-bold leading-tight text-fg sm:text-4xl md:text-5xl">
                      Experience the Future of{" "}
                      <span className="text-brand-text">Drone Operations</span>
                    </h2>
                    <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-fg-2 sm:text-lg">
                      Three simple steps take you from mission concept to airborne
                      reality. Plan your route, get instant authorization, and launch
                      with confidence.
                    </p>
                  </div>
                }
              >
                <div className="flex h-full w-full items-center justify-center gap-6 rounded-2xl bg-gradient-to-br from-surface via-surface-2 to-subtle p-6 sm:gap-12">
                  {steps.map(({ icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-3">
                      <ServiceMark icon={icon} className="h-16 w-16 rounded-2xl sm:h-24 sm:w-24" />
                      <span className="text-sm font-semibold tracking-wide text-fg sm:text-lg">{label}</span>
                    </div>
                  ))}
                </div>
              </ContainerScroll>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 sm:py-32">
          <div className="container mx-auto px-4">
            <div className="rounded-2xl border border-line bg-surface p-8 sm:p-12">
              <div className="mb-16 text-center">
                <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-brand-text">
                  Core Capabilities
                </p>
                <h2 className="text-3xl font-bold text-fg sm:text-4xl md:text-5xl">
                  The Three Pillars
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-fg-2">
                  Every successful drone mission is built on planning, compliance,
                  and execution. PAUTHFLY handles all three.
                </p>
              </div>

              <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
                {features.map((feature) => (
                  <div key={feature.title} className="flex flex-col items-center">
                    <div className="relative h-48 w-48 sm:h-56 sm:w-56">
                      <EvervaultCard text={feature.label} />
                    </div>
                    <div className="mt-6 flex items-center gap-2 text-fg">
                      <feature.icon className="h-5 w-5 text-brand-text" aria-hidden="true" />
                      <h3 className="text-xl font-semibold">{feature.title}</h3>
                    </div>
                    <p className="mt-3 max-w-xs text-center text-sm leading-relaxed text-fg-2">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Gallery / Showcase */}
        <section className="py-20 sm:py-32">
          <div className="container mx-auto px-4">
            <div className="rounded-2xl border border-line bg-surface p-8 sm:p-12">
              <Gallery4
                title="See It In Action"
                description="From mission planning to post-flight analysis, explore the tools that power modern drone operations."
                items={galleryItems}
              />
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 sm:py-32">
          <div className="container mx-auto px-4">
            <div className="rounded-2xl border border-line bg-surface-2 p-12 shadow-theme-lg sm:p-16">
              <div className="flex flex-col items-center text-center">
                <h2 className="text-3xl font-bold text-fg sm:text-4xl md:text-5xl">
                  Ready to Take Flight?
                </h2>
                <p className="mt-6 max-w-lg leading-relaxed text-fg-2">
                  Join the next generation of UAS operators. Plan smarter, fly safer,
                  and manage your entire drone operation from a single platform.
                </p>
                <div className="mt-10">
                  <InteractiveHoverButton text="Enter Platform" href="/launch" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
