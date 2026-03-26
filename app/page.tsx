"use client";

import dynamic from "next/dynamic";
import { Map, ShieldCheck, Rocket } from "lucide-react";
import { InteractiveHoverButton } from "./components/ui/interactive-hover-button";
import { ContainerScroll } from "./components/ui/container-scroll-animation";
import { EvervaultCard } from "./components/ui/evervault-card";
import { Gallery4 } from "./components/ui/gallery4";

const ShaderBackground = dynamic(
  () => import("@/components/ui/animated-shader-background"),
  { ssr: false }
);

const galleryItems = [
  {
    id: "1",
    title: "Interactive Map Planning",
    description:
      "Design complex flight missions with our drag-and-drop map interface. Set waypoints, define altitudes, and visualize your entire operation before takeoff.",
    href: "#",
    image:
      "https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=1080&q=80",
  },
  {
    id: "2",
    title: "Real-time Authorization",
    description:
      "Submit your flight plan and receive airspace clearance in minutes. Our automated pipeline ensures regulatory compliance without the paperwork.",
    href: "#",
    image:
      "https://images.unsplash.com/photo-1506947411487-a56738cd0124?w=1080&q=80",
  },
  {
    id: "3",
    title: "Live Flight Monitoring",
    description:
      "Track your active flights with real-time telemetry and 3D trajectory visualization. Full situational awareness from launch to landing.",
    href: "#",
    image:
      "https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=1080&q=80",
  },
  {
    id: "4",
    title: "Geoawareness Integration",
    description:
      "Stay informed about restricted airspace, NOTAMs, and dynamic geozones. Automatic alerts keep your operations safe and compliant.",
    href: "#",
    image:
      "https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=1080&q=80",
  },
  {
    id: "5",
    title: "Multi-format Support",
    description:
      "Import and export flight plans in multiple industry formats. Seamless interoperability with your existing ground control software.",
    href: "#",
    image:
      "https://images.unsplash.com/photo-1527977966376-1c8408f9f108?w=1080&q=80",
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
      "Activate your authorized flight with one click. Real-time telemetry, geofencing alerts, and full mission monitoring from takeoff to landing.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-black text-white">
      {/* Fixed shader background for entire page */}
      <div className="fixed inset-0 z-0">
        <ShaderBackground />
      </div>
      <div className="fixed inset-0 z-[1] bg-black/50" />

      {/* Scrollable content */}
      <div className="relative z-10">
        {/* ─── Hero Section ─── */}
        <section className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center text-center px-4 max-w-2xl">
            <h1
              className="text-6xl sm:text-7xl md:text-8xl font-extrabold tracking-tight text-white splash-fade-in-up"
              style={{ animationDelay: "0.2s" }}
            >
              PAUTHFLY
            </h1>
            <p
              className="mt-4 text-lg sm:text-xl md:text-2xl text-gray-300 font-light tracking-wide splash-fade-in-up"
              style={{ animationDelay: "0.5s" }}
            >
              Plan. Authorize. Fly.
            </p>
            <p
              className="mt-6 text-sm sm:text-base text-gray-400 leading-relaxed splash-fade-in-up"
              style={{ animationDelay: "0.65s" }}
            >
              The all-in-one UAS flight management platform. Define your mission,
              get airspace authorization, and activate your flight plan —
              seamlessly.
            </p>
            <div
              className="mt-10 splash-fade-in-up"
              style={{ animationDelay: "0.8s" }}
            >
              <InteractiveHoverButton text="Enter Platform" href="/launch" />
            </div>
          </div>
        </section>

        {/* ─── How It Works — ContainerScroll ─── */}
        <section className="py-20 sm:py-32">
          <div className="container mx-auto px-4">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 sm:p-12">
              <ContainerScroll
                titleComponent={
                  <div className="max-w-3xl mx-auto">
                    <p className="text-sm sm:text-base font-semibold uppercase tracking-widest text-blue-400 mb-4">
                      How It Works
                    </p>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight">
                      Experience the Future of{" "}
                      <span className="bg-gradient-to-r from-blue-400 to-violet-500 bg-clip-text text-transparent">
                        Drone Operations
                      </span>
                    </h2>
                    <p className="mt-6 text-base sm:text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
                      Three simple steps take you from mission concept to airborne
                      reality. Plan your route, get instant authorization, and launch
                      with confidence.
                    </p>
                  </div>
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=1400&q=80"
                  alt="Drone aerial operations"
                  className="w-full h-full object-cover object-center rounded-2xl"
                  draggable={false}
                />
              </ContainerScroll>
            </div>
          </div>
        </section>

        {/* ─── Features — EvervaultCard ─── */}
        <section className="py-20 sm:py-32">
          <div className="container mx-auto px-4">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 sm:p-12 shadow-[0_0_50px_rgba(59,130,246,0.1)]">
              <div className="text-center mb-16">
                <p className="text-sm font-semibold uppercase tracking-widest text-blue-400 mb-4">
                  Core Capabilities
                </p>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white">
                  The Three Pillars
                </h2>
                <p className="mt-4 text-gray-400 max-w-xl mx-auto">
                  Every successful drone mission is built on planning, compliance,
                  and execution. PAUTHFLY handles all three.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {features.map((feature) => (
                  <div key={feature.title} className="flex flex-col items-center">
                    <div className="relative w-48 h-48 sm:w-56 sm:h-56">
                      <EvervaultCard text={feature.label} />
                    </div>
                    <div className="mt-6 flex items-center gap-2 text-white">
                      <feature.icon className="w-5 h-5 text-blue-400" />
                      <h3 className="text-xl font-semibold">{feature.title}</h3>
                    </div>
                    <p className="mt-3 text-sm text-gray-400 text-center max-w-xs leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── Gallery / Showcase ─── */}
        <section className="py-20 sm:py-32">
          <div className="container mx-auto px-4">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 sm:p-12">
              <Gallery4
                title="See It In Action"
                description="From mission planning to post-flight analysis — explore the tools that power modern drone operations."
                items={galleryItems}
              />
            </div>
          </div>
        </section>

        {/* ─── Final CTA ─── */}
        <section className="py-24 sm:py-32">
          <div className="container mx-auto px-4">
            <div className="bg-gradient-to-br from-blue-500/10 via-violet-500/10 to-purple-500/10 backdrop-blur-sm border border-white/10 rounded-2xl p-12 sm:p-16 shadow-[0_0_80px_rgba(139,92,246,0.15)]">
              <div className="flex flex-col items-center text-center">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white">
                  Ready to Take Flight?
                </h2>
                <p className="mt-6 text-gray-400 max-w-lg leading-relaxed">
                  Join the next generation of UAS operators. Plan smarter, fly safer,
                  and manage your entire drone operation from a single platform.
                </p>
                <div className="mt-10">
                  <InteractiveHoverButton text="Get Started" href="/launch" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
