"use client";

import { PlanAuthorization } from "@/app/components/plan-authorization/PlanAuthorization";

// NEXT_PUBLIC_PRODUCTION_MODE === "true" -> guided production workflow; otherwise Dev = prod + researcher/bulk tools.
// Keep the literal env access so Next inlines it into the client bundle.
export default function PlanAuthorizationPage() {
  return (
    <div className="w-full bg-canvas">
      <PlanAuthorization mode={process.env.NEXT_PUBLIC_PRODUCTION_MODE === "true" ? "prod" : "dev"} />
    </div>
  );
}
