"use client";
import dynamic from 'next/dynamic';

// Dynamic import to avoid Leaflet SSR issues in Next.js 16
const PlanGenerator = dynamic(
  () => import("../components/PlanGenerator"),
  { ssr: false }
);

export default function PlanGeneratorPage() {
  return <PlanGenerator />;
} 