"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

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
      <div className="relative z-10 flex flex-col items-center text-center px-4">
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

        {/* CTA Button */}
        <Link
          href="/launch"
          className="mt-10 splash-fade-in-up inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-lg font-semibold text-white bg-gradient-to-r from-blue-500 to-violet-600 shadow-lg splash-glow-btn transition-transform duration-200 hover:scale-105 active:scale-95"
          style={{ animationDelay: "0.8s" }}
        >
          Enter Platform
          <ChevronRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
}
