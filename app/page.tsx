"use client";

import dynamic from "next/dynamic";
import { InteractiveHoverButton } from "./components/ui/interactive-hover-button";

const ShaderBackground = dynamic(
  () => import("@/components/ui/animated-shader-background"),
  { ssr: false }
);

export default function SplashPage() {
  return (
    <div className="relative flex-1 flex items-center justify-center overflow-hidden">
      {/* Shader background — fills entire container */}
      <div className="absolute inset-0 z-0">
        <ShaderBackground />
      </div>

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 z-[1] bg-black/30" />

      {/* Centered content */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-2xl">
        {/* App name */}
        <h1
          className="text-6xl sm:text-7xl md:text-8xl font-extrabold tracking-tight text-white splash-fade-in-up"
          style={{ animationDelay: "0.2s" }}
        >
          AETHON
        </h1>

        {/* Tagline */}
        <p
          className="mt-4 text-lg sm:text-xl md:text-2xl text-gray-300 font-light tracking-wide splash-fade-in-up"
          style={{ animationDelay: "0.5s" }}
        >
          Plan. Authorize. Fly.
        </p>

        {/* Brief marketing description */}
        <p
          className="mt-6 text-sm sm:text-base text-gray-400 leading-relaxed splash-fade-in-up"
          style={{ animationDelay: "0.65s" }}
        >
          The all-in-one UAS flight management platform. Define your mission,
          get airspace authorization, and activate your flight plan — seamlessly.
        </p>

        {/* CTA Button */}
        <div
          className="mt-10 splash-fade-in-up"
          style={{ animationDelay: "0.8s" }}
        >
          <InteractiveHoverButton text="Enter Platform" href="/launch" />
        </div>
      </div>
    </div>
  );
}
