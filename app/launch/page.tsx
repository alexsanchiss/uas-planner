"use client";

import { AppChoice } from "../components/app-choice";
import { useRouter } from "next/navigation";
import { HelpCircle } from "lucide-react";
import dynamic from "next/dynamic";

const ShaderBackground = dynamic(
  () => import("@/components/ui/animated-shader-background"),
  { ssr: false }
);

const apps = [
  {
    name: "Plan Definition",
    description:
      "Design your flight mission on an interactive map. Set waypoints, configure scan patterns, and define your operational volume.",
    image: "/images/plan-definition.png",
  },
  {
    name: "Plan Authorization",
    description:
      "Submit your flight plan for airspace approval. Track its status in real time and receive authorization to operate.",
    image: "/images/plan-authorization.png",
  },
  {
    name: "Plan Activation",
    description:
      "Go live. Activate your authorized flight plan and monitor geoawareness data for a safe operation.",
    image: "/images/plan-activation.png",
  },
];

export default function LaunchPage() {
  const router = useRouter();

  const handleLaunchApp = (appName: string) => {
    console.log(`Launching ${appName}`);
    if (appName === "Plan Authorization") {
      router.push("/plan-authorization");
    }
    if (appName === "Plan Definition") {
      router.push("/plan-definition");
    }
    if (appName === "Plan Activation") {
      router.push("/plan-activation");
    }
  };

  return (
    <div className="relative min-h-screen">
      {/* Shader background */}
      <div className="fixed inset-0 z-0">
        <ShaderBackground />
      </div>
      <div className="fixed inset-0 z-[1] bg-black/40" />

      {/* Help Button */}
      <a
        href="/how-it-works"
        className="fixed top-24 right-8 z-[9999] bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-full p-3 shadow-lg flex items-center gap-2 transition-all duration-200"
        title="Need help?"
      >
        <HelpCircle className="w-6 h-6" />
      </a>

      {/* Content */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Page heading */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Choose Your Service
          </h1>
          <p className="mt-3 text-gray-300 text-lg max-w-xl mx-auto">
            From mission design to live activation — select where you want to start.
          </p>
        </div>

        {/* App Choices */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {apps.map((app, index) => (
            <AppChoice
              key={index}
              {...app}
              onLaunch={() => handleLaunchApp(app.name)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
