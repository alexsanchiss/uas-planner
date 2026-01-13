"use client";

import { FlightPlansUploader } from "../components/FlightPlansUploader";
import { FlightPlansUploaderDev } from "../components/FlightPlansUploaderDev";
import { ProtectedRoute } from "../components/auth/protected-route";

// Use NEXT_PUBLIC_PRODUCTION_MODE to determine which component to render
// Default to Dev mode (false) since Production component isn't fully built yet
const isProductionMode = process.env.NEXT_PUBLIC_PRODUCTION_MODE === "true";

export default function TrajectoryGenerator() {
  return (
    <ProtectedRoute>
      <div className="bg-gray-900">
        {/* <Header /> */}
        {isProductionMode ? <FlightPlansUploader /> : <FlightPlansUploaderDev />}
      </div>
    </ProtectedRoute>
  );
}
