"use client";

import type { LucideIcon } from "lucide-react";
import { Button } from "./ui/button";
import { ServiceMark } from "./brand-mark";

interface AppChoiceProps {
  name: string;
  description: string;
  icon: LucideIcon;
  onLaunch: () => void;
}

export function AppChoice({
  name,
  description,
  icon,
  onLaunch,
}: AppChoiceProps) {
  return (
    <div className="flex flex-col bg-black/60 backdrop-blur-sm rounded-lg shadow-md overflow-hidden border border-white/10 transition-transform duration-200 hover:scale-[1.02]">
      <div className="flex h-60 items-center justify-center border-b border-white/10 bg-white/[0.03]">
        <ServiceMark icon={icon} className="h-24 w-24 rounded-3xl" />
      </div>
      <div className="flex flex-col flex-1 p-4">
        <h2 className="text-xl font-bold text-white mb-2">{name}</h2>
        <p className="text-gray-300 mb-4 flex-1">{description}</p>
        <Button onClick={onLaunch} className="w-full">
          Launch
        </Button>
      </div>
    </div>
  );
}
