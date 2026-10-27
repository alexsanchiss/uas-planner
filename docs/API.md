# API

Route handlers live in `app/api/**/route.ts` (App Router). Source of truth is the code; this page lists what clients and external systems rely on. Architecture: [ARCHITECTURE.md](ARCHITECTURE.md).

**EXTERNAL** marks contracts that other systems call or consume. They must stay byte-compatible: path, method, auth, body shape, status codes and messages. Everything else is internal to the UI (change front and back together).

## Conventions

- Auth `JWT`: `Authorization: Bearer <access token>` (`withAuth`). Missing or invalid token: `401 {error}`.
- Auth `machine`: header `x-machine-api-key` (`MACHINE_API_KEY`). `401` if missing or wrong, `500` if the server has no key configured.
- Errors are JSON, mostly `{error}`; some add `message`, `details` (zod, `Validation failed`) or `code`. Other codes in use: 429 (`Retry-After` on rate-limited auth routes), 502, 503, 504.
- Plan ids are integers; an invalid id is `400 {error:'Invalid flight plan ID'}`.
- Ownership: plans, folders, drafts and CSV results are scoped to the token's user. By-id plan and folder routes answer `404` for a missing resource and `403 {error:'Access denied'}` for another user's; `/api/csvResult` and `/api/user/drafts/[id]` answer `404` for both cases.
- Statuses. `status`: `sin procesar`, `en cola`, `procesando`, `procesado`, `error`. `authorizationStatus`: `sin autorización`, `pendiente`, `aprobado`, `denegado`, `withdrawn` (the UI also writes `procesando autorización`).
- Clients can only write a restricted set of plan fields through `PUT` (`status` to `en cola`/`sin procesar`, `authorizationStatus` to `sin autorización`/`procesando autorización`, and nulls to clear `authorizationMessage`, `externalResponseNumber`, `csvResult`). Anything else is `400`. Plans in `aprobado` or `pendiente` reject U-Plan edits (`400`) unless the same request resets `authorizationStatus` to `sin autorización`.

## Auth (`/api/auth/*`)

| Method and path | Auth | Body | Responses |
|---|---|---|---|
| POST `/signup` | public | `{email, password (>=8), confirmPassword, firstName?, lastName?, phone?}` | 201 `{message}`; 400 validation or `Email already in use`. Sends the verification email. |
| POST `/login` | public | `{email, password}` | 200 `{token}` + httpOnly cookie `refreshToken` (30 d); 200 `{requiresVerification:true, email}` if unverified; 400; 429 (5 per 15 min per IP) |
| POST `/logout` | public | none | 200 `{success:true}`, cookie cleared |
| POST `/refresh` | cookie `refreshToken` | none | 200 `{token}` + new cookie; 401 |
| POST `/verify-email` | public | `{token}` or `{email, code}` | 200 `{message}`; 400; 429 |
| POST `/resend-verification` | public | `{email}` | 200 (same message whether or not the email exists); 429 (60 s cooldown) |
| POST `/forgot-password` | public | `{email}` | 200 always; 429. Email link `/reset-password?token=` (**EXTERNAL**, user-facing) |
| POST `/reset-password` | public | `{token, newPassword (>=8)}` | 200; 400 |

The email link `/verify-email?token=` is also **EXTERNAL**.

## User, drafts, contact, Cesium

| Method and path | Auth | Notes |
|---|---|---|
| GET `/api/user` | JWT | `{id, username, email, firstName, lastName, phone}` |
| GET, PATCH `/api/user/profile` | JWT | PATCH `{firstName?, lastName?, phone?}` |
| GET, POST `/api/user/drafts` | JWT | POST `{name, draftData}`; lists return `{id, name, createdAt, updatedAt}` |
| GET, PATCH, DELETE `/api/user/drafts/[id]` | JWT | owner only; DELETE `{success:true}` |
| POST `/api/contact` | JWT | `{subject, category, description}` returns `{ticketNumber, message}` |
| GET `/api/cesium/token` | JWT | `{token}`; 500 if `CESIUM_ION_TOKEN` is unset |

## Flight plans

| Method and path | Auth | Body and behaviour |
|---|---|---|
| GET `/api/flightPlans` | JWT | All plans of the user, newest first. **`?fields=summary`**: rows without `fileContent`, `uplan`, `activationMessage`, plus booleans `hasFileContent`, `hasUplan`. Any other value returns full rows. **`?fields=summary&limit=1..100`** (opt-in paging): `&offset=n` `&folderId=<id\|none>` `&q=<name contains>` `&authorizationStatus=<exact>` -> `{ items, total }` (summary rows, newest first); 400 on bad params, 404 for a folder that is not the caller's. |
| POST `/api/flightPlans` | JWT | Single `{customName, status, fileContent, folderId?, uplan?, scheduledAt?, geoawarenessData?}` returns 201 plan; bulk `{items:[...]}` (max 2000) returns 201 `{createdCount, items}`; external `{type:'external_uplan', uplan, folderId, customName}` returns 201 plan already `procesado`. |
| PUT `/api/flightPlans` | JWT | Three shapes: `{id, data}` returns the plan (404 if not yours); `{ids, data}` (max 100000) and `{items:[{id,data}]}` (max 2000) return `{count}`. Writable fields: see Conventions. |
| DELETE `/api/flightPlans` | JWT | `{id}` or `{ids}`; 200 `{deletedPlans, deletedCsvs, totalDeleted, message}`; 404. Approved plans are cancelled in FAS and the owner is emailed. |
| GET, PUT, DELETE `/api/flightPlans/[id]` | JWT, owner | Full row + folder. DELETE returns `{message, deletedPlan, deletedCsvResult}`. |
| POST `/[id]/generate-volumes` | JWT, owner | 200 `{success, volumesGenerated, randomDataGenerated, uplan}` |
| POST `/[id]/uplan` | JWT, owner | No body. Sends the U-Plan to FAS. 200 `{uplan, authorizationMessage}` and `pendiente`; FAS 4xx is persisted (`withdrawn` for 400, else `denegado`) and answered with FAS's status; 503 if FAS is unreachable or keeps answering 500. |
| POST `/[id]/reset` | JWT, owner | 200 `{message, flightPlan, csvResultDeleted}`; 400 `{code:'ALREADY_UNPROCESSED'}` or external plan |
| POST `/[id]/accept-alternative` | JWT, owner | 200 `{flightPlan}`; 400 unless `denegado` with an SCRS alternative |
| GET `/[id]/terms` | JWT, owner | FAS terms, verbatim; 502 if FAS is down |
| POST `/[id]/activate` | JWT, owner | `{termsAccepted:true}`. Window scheduledAt +-300 s, cooldown 5 s (429). If FAS denies the answer is **HTTP 200 with `{error:'Activación denegada', message, retryAt, flightPlan}`**: clients branch on the body. |
| POST, GET `/[id]/geoawareness` | JWT, owner | POST `{success, uspaceIdentifier, wsUrl}`; GET `{success, planId, planName, geoawareness}` |
| GET `/active` | JWT | Approved plans scheduled between now-1 h and now+24 h: `{plans}` |
| GET `/history` | JWT | `?limit` (1..100, default 50), `?offset`: `{plans, total, limit, offset}` |
| POST `/regenerate-volumes` | JWT | `{success, plansChecked, plansRegenerated, errors}` |

## Folders and CSV

| Method and path | Auth | Notes |
|---|---|---|
| GET `/api/folders` | JWT | Folders with plans. **`?fields=summary`**: each folder carries `flightPlans: [{id}]` only. **`?fields=counts`**: `{ folders: [folder + planCount], noFolderCount }`, no plan rows. |
| POST `/api/folders` | JWT | `{name, minScheduledAt?, maxScheduledAt?}` returns 201 |
| GET, PUT, DELETE `/api/folders/[id]` | JWT, owner | DELETE answers **204 without body** and deletes the folder's plans without cancelling them in FAS |
| POST `/api/folders/[id]/clone` | JWT, owner | `{folder, flightPlans}` |
| GET `/api/csvResult?id=` | JWT, owner | `{csvResult}`; 404 `CSV no encontrado` |
| POST `/api/csvResult` | JWT | `{ids}` (max 5000): `{items:[{id, customName, csvResult}]}`, only owned plans that have a CSV |
| DELETE `/api/csvResult` | JWT | `{id}` returns **204**; `{ids}` returns `{deletedCount}`; owned plans only |

The CSV row has the same id as its plan (`flightPlan.csvResult` is a 0/1 flag).

## FAS callback (EXTERNAL)

`PUT /api/fas/[externalResponseNumber]`, public, no JWT. Called by FAS.

- Body `{state: string, message?: string | object}`. `state === 'ACCEPTED'` sets `authorizationStatus='aprobado'`; any other value sets `'denegado'`. An object `message` is stored as a JSON string; `uplan.state` is rewritten; the plan owner is emailed.
- Responses: 200 `{success:true}`; 400 `Invalid JSON body` / `Missing required field: state`; 404 `FlightPlan not found`; 403 `Forbidden`; 500.
- `FAS_CALLBACK_ALLOWED_IPS` (comma-separated, optional): if set, only those source IPs are accepted, others get 403. Source IP is the right-most `X-Forwarded-For` entry (appended by Caddy), else `X-Real-IP`. Unset or empty means open, as before. Every callback logs `[FAS Callback] source IP: ...`; check that log before enabling the allowlist. Only safe if all traffic goes through the proxy.

## Machine API (`x-machine-api-key`, EXTERNAL)

| Method and path | Notes |
|---|---|
| GET `/api/machine/flightPlans/by-external-response-number/[n]` | 200 `{customName}` only; 400 `Invalid external response number` (empty, >255 chars, control chars); 404 `Flight plan not found`. Used by a third party. |
| GET `/api/machine/flightPlans/by-external-response-number` | Always 400 after auth (stub) |
| GET `/api/machine/flightPlans?email=` | `{flightPlans:[{id, customName, scheduledAt, externalResponseNumber, activationStatus}]}`, approved plans only; 400 without `email`, 404 unknown user. The working tree currently adds a `scheduledAt >= now - 5 min` filter (uncommitted): treat as a contract change and confirm with the consumer. |
| GET `/api/machine/flightPlans/[id]/terms?email=` | FAS terms; 403 if the plan is not the email's |
| POST `/api/machine/flightPlans/[id]/activate` | `{email, termsAccepted:true}`; same as user activation but window scheduledAt +-60 s |

The consumers of everything except `by-external-response-number/[n]` are not identified: treat all of it as EXTERNAL.

## Geoawareness (EXTERNAL upstream)

| Method and path | Auth | Notes |
|---|---|---|
| GET `/api/geoawareness/uspaces` | public | `{success, uspaces:[{id, name, boundary:[{latitude, longitude}]}], count}`; upstream `GET http://{GEOAWARENESS_SERVICE_IP}/{GEOAWARENESS_USPACES_ENDPOINT}` (timeout 15 s, expects `{u_spaces:[...]}`); 502/503/504. `GEOAWARENESS_USPACES_ENDPOINT=PRUEBA` returns fixed test U-spaces. |
| GET `/api/geoawareness/stream/[uspaceId]` | public | `text/event-stream`. Opens `ws://{GEOAWARENESS_SERVICE_IP}/{GEOAWARENESS_ENDPOINT}{uspaceId}` and forwards each upstream message verbatim as `data:`; extra events `connected`, `error`, `close`. 400 on ids not matching `^[a-zA-Z0-9_-]{1,50}$`. |
| GET `/api/deprecated/geoawareness-geozones?uspaceId=` | public | Fixed fallback geozones; deprecated |

## Outbound FAS calls (EXTERNAL)

All in `lib/fas.ts`; base URL is `FAS_API_URL` (default is a fixed SNA lab address, see `lib/fas.ts`). Except the U-Plan POST, only protocol and host are used (the path is dropped).

| Call | Timeout |
|---|---|
| `POST {FAS_API_URL}` with the U-Plan JSON (response stored as `externalResponseNumber`; 500 retried up to 5 times with 1/2/4/8 s waits) | 120 s |
| `DELETE {base}/uplan_cancelation/{n}` (failures are logged, never block) | 30 s |
| `GET {base}/terms/{n}` | 30 s |
| `GET {base}/activation/{n}` | 10 s |

## Other external contracts

- Shared MySQL schema (`prisma/schema.prisma`), read and written directly by the VMs/traj-runner, `traj-assigner.js` and `machine-cleaner.js`: table and column names, `flightPlan.status` values, `machine.status` (`Disponible`/`Ocupada`), `csvResult.id == flightPlan.id`.
- Email links `APP_URL/verify-email?token=` and `APP_URL/reset-password?token=`.
- Browser persistence: localStorage `authToken`, cookie `refreshToken`, JWT claims `userId` and `type`.

## Differences with ICD v2.4.0 (`docs/icd`)

The ICD `.tex` is not edited. Compared with the code (route audit, `tasks/audit/API_CONTRACTS.md`; items marked * were re-checked after the restructure):

1. `GET /api/flightPlans?userId=` and `/api/folders?userId=`: the query param is ignored; the user comes from the token.*
2. `/api/machines` and `/api/machines/<id>` do not exist in `app/api`; VMs update the database directly.
3. Password reset is `POST /api/auth/forgot-password`, not `request-password-reset`.
4. Everything is App Router; most routes need JWT, not only `GET /api/user`.
5. Only `FAS_API_URL` exists (`FAS_IP`/`FAS_ENDPOINT` are dead).
6. JWT lifetimes are 7 d (access) and 30 d (refresh), not 1 day.*
7. Email verification code: the code expires after 3 minutes, while the email text and the ICD say 24 h.
8. Activation window: user route +-300 s, machine route +-60 s; the ICD says +-60 s.*
9. `POST /[id]/geoawareness` returns `{success, uspaceIdentifier, wsUrl}`, not geozones/trajectory/`hasConflicts`; there is no mock response.
10. FAS retry waits are 1/2/4/8 s (not 16 s); a network error is not persisted and answers 503; a FAS 400 marks the plan `withdrawn`.
11. `DELETE /api/uplan_cancelation/<n>` is a call to FAS, not a UPPS route.
12. `machine.status` values: ICD `Disponible`/`Ocupada`; `traj-assigner.js` uses `Ocupada`, `lib/validators.ts` defines `Ocupado`.
13. `GET /api/flightPlans/[id]` is fully implemented (GET/PUT/DELETE), not a placeholder.
14. The documented 50 mb / 10 mb body limits are not enforced by the App Router.
15. The ICD documents one machine route; there are five.
