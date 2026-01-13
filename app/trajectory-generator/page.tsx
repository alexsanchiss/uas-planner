"use client";

import { FlightPlansUploader } from "../components/FlightPlansUploader";
import { ProtectedRoute } from "../components/auth/protected-route";

export default function TrajectoryGenerator() {
  return (
    <ProtectedRoute>
      <div className="bg-gray-900">
        {/* <Header /> */}
        <FlightPlansUploader />
      </div>
    </ProtectedRoute>
  );
}
