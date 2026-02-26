"use client";

import dynamic from 'next/dynamic';
import { ProtectedRoute } from '../components/auth/protected-route';

const PlanGeneratorPage = dynamic(() => import('./PlanGeneratorPage'), { ssr: false });

export default function Page() {
  return (
    <ProtectedRoute>
      <PlanGeneratorPage />
    </ProtectedRoute>
  );
}
