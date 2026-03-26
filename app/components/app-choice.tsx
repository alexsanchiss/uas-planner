"use client";

import Image from "next/image";
import { Button } from "./ui/button";

interface AppChoiceProps {
  name: string;
  description: string;
  image: string;
  onLaunch: () => void;
}

export function AppChoice({
  name,
  description,
  image,
  onLaunch,
}: AppChoiceProps) {
  return (
    <div className="flex flex-col bg-black/60 backdrop-blur-sm rounded-lg shadow-md overflow-hidden border border-white/10 transition-transform duration-200 hover:scale-[1.02]">
      <Image
        src={image}
        alt={name}
        width={400}
        height={200}
        className="w-full h-60 object-cover flex-shrink-0"
      />
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
