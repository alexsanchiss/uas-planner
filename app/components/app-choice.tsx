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
    <div className="bg-[var(--surface-primary)] rounded-lg shadow-md overflow-hidden border border-[var(--border-primary)]">
      <Image
        src={image}
        alt={name}
        width={400}
        height={200}
        className="w-full h-60 object-cover"
      />
      <div className="p-4">
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">{name}</h2>
        <p className="text-[var(--text-secondary)] mb-4">{description}</p>
        <Button onClick={onLaunch} className="w-full">
          Launch
        </Button>
      </div>
    </div>
  );
}
