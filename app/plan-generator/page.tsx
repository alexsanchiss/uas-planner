"use client";

import dynamic from 'next/dynamic';

const PlanGeneratorPage = dynamic(() => import('./PlanGeneratorPage'), { ssr: false });

export default function Page() {
  return <PlanGeneratorPage />;
}
