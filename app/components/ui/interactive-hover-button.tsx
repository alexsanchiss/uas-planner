"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface InteractiveHoverButtonProps {
  text?: string;
  href?: string;
  className?: string;
}

export function InteractiveHoverButton({
  text = "Enter Platform",
  href = "/launch",
  className,
}: InteractiveHoverButtonProps) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={() => router.push(href)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-full border border-white/30 bg-white/10 backdrop-blur-sm px-8 py-3.5 text-center font-semibold text-lg text-white transition-all duration-300 hover:bg-white/20 hover:shadow-[0_0_30px_rgba(139,92,246,0.3)]",
        className
      )}
    >
      {/* Expanding dot from the left */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "100%", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500/40 to-violet-600/40"
          />
        )}
      </AnimatePresence>

      {/* Text + arrow */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {text}
        <motion.span
          animate={{ x: isHovered ? 4 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </motion.span>
      </span>
    </button>
  );
}
