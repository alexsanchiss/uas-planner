// pages/api/flightPlans/[id].ts
//
// ⚠️  DEPRECATED ROUTE - DO NOT USE FOR NEW DEVELOPMENT
// ======================================================
//
// This route has been deprecated in favor of the unified API at /api/flightPlans.
// All operations (create, read, update, delete) are now handled by the main endpoint.
//
// MIGRATION GUIDE:
// ================
//
// OLD (Deprecated):                    NEW (Unified):
// -----------------------------------   -----------------------------------
// PUT /api/flightPlans/123            PUT /api/flightPlans
// Body: { status: "en cola" }        Body: { id: 123, data: { status: "en cola" } }
//
// DELETE /api/flightPlans/123         DELETE /api/flightPlans
//                                     Body: { id: 123 }
//
// PUT /api/flightPlans/123            PUT /api/flightPlans
// Body: { customName: "New Name" }   Body: { id: 123, data: { customName: "New Name" } }
//
// BENEFITS OF THE NEW SYSTEM:
// - Single endpoint for all operations
// - Better performance for bulk operations
// - Transaction safety
// - Unified error handling
// - Optimized for large datasets
//
// EXCEPTION: This route is kept ONLY for the U-plan generation endpoint
// which has specific business logic that doesn't fit the unified pattern.
//
// For all other operations, use /api/flightPlans with the appropriate HTTP method.

export default function handler() {
  // This route is deprecated - use /api/flightPlans instead
}
