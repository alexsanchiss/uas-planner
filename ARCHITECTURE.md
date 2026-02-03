# Architecture Documentation

## Database Schema - Important Relationships

### ⚠️ CRITICAL: flightPlan ↔ csvResult Relationship

**The relationship between `flightPlan` and `csvResult` is 1:1 via the SAME ID.**

```typescript
// ❌ INCORRECT - This is WRONG!
const csvResult = await prisma.csvResult.findUnique({
  where: { id: flightPlan.csvResult }  // csvResult is just a boolean flag!
});

// ✅ CORRECT - Use the same ID
const csvResult = await prisma.csvResult.findUnique({
  where: { id: flightPlan.id }  // Use flightPlan's ID directly
});
```

#### Key Points:

1. **`flightPlan.csvResult`** is a **BOOLEAN FLAG** (0 or 1), NOT an ID
   - `0` or `NULL` = No CSV result exists
   - `1` = CSV result exists

2. **The `csvResult` table uses the SAME ID as `flightPlan`**
   - If `flightPlan.id = 5`, then `csvResult.id = 5` (if it exists)
   - This is a 1:1 relationship via primary key matching

3. **Correct usage pattern:**
   ```typescript
   const plan = await prisma.flightPlan.findUnique({ where: { id: planId } });
   
   if (!plan.csvResult) {
     // No CSV exists for this plan
     return null;
   }
   
   // Fetch CSV using the SAME ID as the plan
   const csv = await prisma.csvResult.findUnique({ 
     where: { id: plan.id }  // NOT plan.csvResult!
   });
   ```

#### Database Schema:

```prisma
model flightPlan {
  id         Int      @id @default(autoincrement())
  csvResult  Int?     // BOOLEAN FLAG (0 or 1), NOT an ID!
  // ... other fields
}

model csvResult {
  id        Int    @id   // SAME ID as flightPlan (1:1 relationship)
  csvResult String      // The actual CSV data
  // ... other fields
}
```

#### Files Using This Pattern:

- ✅ `/app/api/flightPlans/[id]/uplan/route.ts` - U-Plan generation
- ✅ `/app/api/flightPlans/regenerate-volumes/route.ts` - Volume regeneration  
- ✅ `/app/components/flight-plans/TrajectoryMapViewer.tsx` - Trajectory viewer
- ✅ `/app/components/flight-plans/GeoawarenessViewer.tsx` - Geoawareness viewer
- ✅ `/app/api/csvResult/route.ts` - CSV API endpoint (receives ID as query param)

---

## Other Important Architectural Notes

### Authentication Flow
- JWT tokens stored in localStorage (`authToken`)
- Middleware: `/lib/auth-middleware.ts`
- All API routes use `withAuth()` wrapper

### Flight Plan Processing Pipeline
1. **Upload** → `status: 'sin procesar'`
2. **Schedule** → Set `scheduledAt` date/time
3. **Process** → `status: 'en proceso'` → Machine processes → Creates `csvResult`
4. **Processed** → `status: 'procesado'`, `csvResult = 1`
5. **Authorize** → Send to FAS → `authorizationStatus: 'aprobado'/'denegado'`

### WebSocket vs HTTP
- **Geoawareness**: WebSocket primary, HTTP fallback
- **Flight Plans**: HTTP polling (5-second intervals)
- **FAS Authorization**: HTTP POST to external API
