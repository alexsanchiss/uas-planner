# UAS Planner - API Documentation

## Overview

The UAS Planner uses a **unified API architecture** built on Next.js App Router, consolidating all operations into standardized endpoints with JWT authentication, Zod validation, and bulk operation support.

## 🔐 Authentication

All protected endpoints require a valid JWT access token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

### Token Flow
1. **Login** (`POST /api/auth/login`) → Returns access token + sets refresh token cookie
2. **Use Access Token** → Include in Authorization header (valid 15 minutes)
3. **Refresh** (`POST /api/auth/refresh`) → Get new access token before expiration
4. **Logout** (`POST /api/auth/logout`) → Clears refresh token cookie

## 📚 API Endpoints

### Authentication (`/api/auth`)

#### **POST /api/auth/signup** - Register User
```typescript
// Request
POST /api/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"  // min 8 characters
}

// Response 201
{ "message": "User created successfully" }

// Response 400
{ "error": "Email already in use" }
```

#### **POST /api/auth/login** - User Login
```typescript
// Request
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}

// Response 200
{ "token": "eyJhbGciOiJIUzI1NiIs..." }
// Also sets httpOnly cookie: refreshToken

// Response 400
{ "error": "Invalid email or password" }
```

#### **POST /api/auth/refresh** - Refresh Access Token
```typescript
// Request (no body needed - uses httpOnly cookie)
POST /api/auth/refresh

// Response 200
{ "token": "eyJhbGciOiJIUzI1NiIs..." }
// Also updates httpOnly cookie with new refreshToken

// Response 401
{ "error": "Invalid or expired refresh token" }
```

#### **POST /api/auth/logout** - Logout
```typescript
// Request
POST /api/auth/logout

// Response 200
{ "success": true }
// Clears refreshToken cookie
```

---

### Flight Plans (`/api/flightPlans`)

**Unified endpoint for all flight plan operations** - supports both individual and bulk operations.

#### **GET /api/flightPlans** - List Flight Plans
```typescript
// Request
GET /api/flightPlans
Authorization: Bearer <token>

// Response 200
[
  {
    "id": 123,
    "customName": "Plan A",
    "status": "procesado",
    "authorizationStatus": "autorizado",
    "scheduledAt": "2024-01-15T10:00:00.000Z",
    "folderId": 1,
    "createdAt": "2024-01-10T08:00:00.000Z",
    "updatedAt": "2024-01-10T09:30:00.000Z"
  },
  // ...
]
```

#### **POST /api/flightPlans** - Create Flight Plan(s)
```typescript
// Individual creation
POST /api/flightPlans
Authorization: Bearer <token>
Content-Type: application/json

{
  "customName": "Plan A",
  "status": "sin procesar",
  "fileContent": "<QGC plan content>",
  "folderId": 1,              // optional
  "scheduledAt": "2024-01-15T10:00:00Z"  // optional
}

// Bulk creation
POST /api/flightPlans
{
  "items": [
    { "customName": "Plan A", "status": "sin procesar", "fileContent": "..." },
    { "customName": "Plan B", "status": "sin procesar", "fileContent": "..." }
  ]
}

// Response 201
{ "id": 123 }  // or { "ids": [123, 124, 125] } for bulk
```

#### **PUT /api/flightPlans** - Update Flight Plan(s)
```typescript
// Individual update
PUT /api/flightPlans
Authorization: Bearer <token>
Content-Type: application/json

{ "id": 123, "data": { "status": "en cola" } }

// Bulk uniform update (same data for all)
PUT /api/flightPlans
{ "ids": [123, 456, 789], "data": { "status": "en cola" } }

// Bulk item update (different data per item)
PUT /api/flightPlans
{
  "items": [
    { "id": 123, "data": { "scheduledAt": "2024-01-15T10:00:00Z" } },
    { "id": 456, "data": { "scheduledAt": "2024-01-16T14:00:00Z" } }
  ]
}

// Response 200
{ "updated": 1 }  // or count for bulk
```

#### **DELETE /api/flightPlans** - Delete Flight Plan(s)
```typescript
// Individual deletion
DELETE /api/flightPlans
Authorization: Bearer <token>
Content-Type: application/json

{ "id": 123 }

// Bulk deletion
DELETE /api/flightPlans
{ "ids": [123, 456, 789] }

// Response 200
{
  "deletedPlans": 3,
  "deletedCsvs": 2,
  "totalDeleted": 5,
  "message": "Successfully deleted 3 flight plans and 2 CSV results"
}
```

---

### Individual Flight Plan (`/api/flightPlans/[id]`)

#### **GET /api/flightPlans/{id}** - Get Single Flight Plan
```typescript
GET /api/flightPlans/123
Authorization: Bearer <token>

// Response 200
{
  "id": 123,
  "customName": "Plan A",
  "status": "procesado",
  "fileContent": "<QGC plan content>",
  "authorizationStatus": "sin autorización",
  "authorizationMessage": null,
  "externalResponseNumber": null,
  "uplan": { /* U-Plan JSON */ },
  "scheduledAt": "2024-01-15T10:00:00.000Z",
  "folderId": 1,
  "userId": 5
}

// Response 404
{ "error": "Flight plan not found" }
```

#### **PUT /api/flightPlans/{id}** - Update Single Flight Plan
```typescript
PUT /api/flightPlans/123
Authorization: Bearer <token>
Content-Type: application/json

{
  "customName": "Updated Plan Name",
  "scheduledAt": "2024-01-20T12:00:00Z"
}

// Response 200
{ "id": 123, "customName": "Updated Plan Name", ... }
```

#### **DELETE /api/flightPlans/{id}** - Delete Single Flight Plan
```typescript
DELETE /api/flightPlans/123
Authorization: Bearer <token>

// Response 200
{ "message": "Flight plan deleted successfully" }
```

---

### Flight Plan Reset (`/api/flightPlans/[id]/reset`)

#### **POST /api/flightPlans/{id}/reset** - Reset Flight Plan
Resets a flight plan to initial state: clears trajectory result, authorization status, and resets status to "sin procesar".

```typescript
POST /api/flightPlans/123/reset
Authorization: Bearer <token>

// Response 200
{
  "id": 123,
  "status": "sin procesar",
  "authorizationStatus": "sin autorización",
  "authorizationMessage": null,
  "externalResponseNumber": null,
  "uplan": null
}

// Response 404
{ "error": "Flight plan not found" }
```

---

### U-Plan Generation (`/api/flightPlans/[id]/uplan`)

#### **POST /api/flightPlans/{id}/uplan** - Generate & Submit U-Plan
Generates U-Plan from trajectory CSV and submits to external FAS API for authorization.

```typescript
POST /api/flightPlans/123/uplan
Authorization: Bearer <token>

// Response 200 (FAS submission successful)
{
  "success": true,
  "externalResponseNumber": "FAS-2024-001234",
  "message": "U-Plan submitted successfully"
}

// Response 400 (no trajectory)
{ "error": "Flight plan has no trajectory result" }

// Response 502 (FAS API error)
{ "error": "Failed to submit to FAS API" }
```

---

### Folders (`/api/folders`)

#### **GET /api/folders** - List Folders
```typescript
GET /api/folders
Authorization: Bearer <token>

// Response 200
[
  {
    "id": 1,
    "name": "January 2024 Missions",
    "userId": 5,
    "minScheduledAt": "2024-01-01T00:00:00.000Z",
    "maxScheduledAt": "2024-01-31T23:59:59.000Z",
    "flightPlans": [
      { "id": 123, "customName": "Plan A", ... },
      { "id": 124, "customName": "Plan B", ... }
    ]
  },
  // ...
]
```

#### **POST /api/folders** - Create Folder
```typescript
POST /api/folders
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "February 2024 Missions",
  "minScheduledAt": "2024-02-01T00:00:00Z",  // optional
  "maxScheduledAt": "2024-02-29T23:59:59Z"   // optional
}

// Response 201
{ "id": 2, "name": "February 2024 Missions", ... }
```

---

### Individual Folder (`/api/folders/[id]`)

#### **GET /api/folders/{id}** - Get Folder with Plans
```typescript
GET /api/folders/1
Authorization: Bearer <token>

// Response 200
{
  "id": 1,
  "name": "January 2024 Missions",
  "flightPlans": [ /* array of plans */ ]
}
```

#### **PUT /api/folders/{id}** - Update/Rename Folder
```typescript
PUT /api/folders/1
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Q1 2024 Missions"
}

// Response 200
{ "id": 1, "name": "Q1 2024 Missions", ... }
```

#### **DELETE /api/folders/{id}** - Delete Folder
Deletes folder and all contained flight plans + their CSV results.

```typescript
DELETE /api/folders/1
Authorization: Bearer <token>

// Response 200
{ "message": "Folder and contents deleted successfully" }
```

---

### CSV Results (`/api/csvResult`)

> **⚠️ CRITICAL: flightPlan ↔ csvResult Relationship**
> 
> The `csvResult` field in `flightPlan` table is a **BOOLEAN FLAG** (0 or 1), **NOT an ID**.
> 
> The `csvResult` table has a **1:1 relationship via the SAME ID** as `flightPlan`:
> - If `flightPlan.id = 5` and `flightPlan.csvResult = 1`, then `csvResult.id = 5`
> - To fetch CSV data: Use `flightPlan.id`, NOT `flightPlan.csvResult`
> 
> ```typescript
> // ✅ CORRECT
> GET /api/csvResult?id=${flightPlan.id}
> 
> // ❌ WRONG - csvResult is just a boolean flag!
> GET /api/csvResult?id=${flightPlan.csvResult}
> ```

#### **GET /api/csvResult** - Get Single CSV Result
```typescript
GET /api/csvResult?id=123
Authorization: Bearer <token>

// Response 200
{ "csvResult": "timestamp,lat,lon,alt\n2024-01-15T10:00:00Z,39.4699,-0.3763,100\n..." }

// Response 404
{ "error": "CSV result not found" }
```

#### **POST /api/csvResult** - Bulk Fetch CSV Results
```typescript
POST /api/csvResult
Authorization: Bearer <token>
Content-Type: application/json

{ "ids": [123, 456, 789] }

// Response 200
{
  "items": [
    { "id": 123, "customName": "Plan A", "csvResult": "..." },
    { "id": 456, "customName": "Plan B", "csvResult": "..." },
    { "id": 789, "customName": "Plan C", "csvResult": null }
  ]
}
```

#### **DELETE /api/csvResult** - Delete CSV Result(s)
```typescript
// Individual
DELETE /api/csvResult
{ "id": 123 }

// Bulk
DELETE /api/csvResult
{ "ids": [123, 456, 789] }

// Response 200
{ "deleted": 3 }
```

---

### FAS Callback (`/api/fas/[externalResponseNumber]`)

**External endpoint** - Called by FAS service to update authorization status. Does NOT require JWT authentication.

#### **PUT /api/fas/{externalResponseNumber}** - Update Authorization
```typescript
PUT /api/fas/FAS-2024-001234
Content-Type: application/json

{
  "authorizationStatus": "autorizado",
  "authorizationMessage": { "details": "Flight approved" }
}

// Response 200
{ "success": true }

// Response 404
{ "error": "Flight plan not found" }
```

---

### User (`/api/user`)

#### **GET /api/user** - Get Current User
```typescript
GET /api/user
Authorization: Bearer <token>

// Response 200
{
  "id": 5,
  "email": "user@example.com"
}
```

---

## 🔧 Data Types

### Flight Plan Status
```typescript
type FlightPlanStatus = 
  | "sin procesar"  // Not processed
  | "en cola"       // Queued
  | "procesando"    // Processing
  | "procesado"     // Processed
  | "error"         // Error
```

### Authorization Status
```typescript
type AuthorizationStatus =
  | "sin autorización"  // Not authorized
  | "pendiente"         // Pending
  | "autorizado"        // Authorized
  | "rechazado"         // Rejected
```

---

## 🛡️ Security & Validation

### Input Validation
All endpoints use Zod schemas from `lib/validators.ts`:
- Email format validation
- Password minimum length (8 chars)
- ID type coercion and validation
- Date format validation (ISO 8601)
- Maximum limits for bulk operations

### Authentication Flow
1. Access tokens expire in 15 minutes
2. Refresh tokens expire in 7 days
3. Refresh tokens stored in httpOnly cookies (XSS protection)
4. Frontend should refresh tokens proactively before expiration

### Authorization
- All protected routes check JWT validity
- Resource ownership verified (user can only access own data)
- FAS callback endpoint is public (external service)

---

## 🔄 Migration from Legacy APIs

### Deprecated Endpoints (pages/api)
The following Pages Router APIs are deprecated and will be removed:
- `pages/api/flightPlans/*`
- `pages/api/folders/*`
- `pages/api/csvResult/*`
- `pages/api/fas/*`

Use the App Router equivalents in `app/api/` instead.

### Changes from v1.0
```typescript
// OLD (Deprecated)
PUT /api/flightPlans/123
Body: { status: "en cola" }

// NEW (Unified)
PUT /api/flightPlans
Body: { id: 123, data: { status: "en cola" } }
```

---

## 📊 Performance Guidelines

### Batch Sizes
- **Flight Plans**: 500 items per request recommended
- **CSV Fetch**: Up to 5000 IDs per request
- **Deletions**: Chunked internally in 200-item transactions

### Concurrency
- Frontend limits to 5 simultaneous uploads
- Downloads split into multiple ZIPs (1000 files each)

---

## 📞 Error Handling

All errors follow this format:
```typescript
{
  "error": "Error message",
  "details"?: { /* additional context */ }
}
```

Common HTTP status codes:
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (resource not owned)
- `404` - Not Found
- `500` - Internal Server Error
