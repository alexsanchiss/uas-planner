# Architecture

Rules for working in the repo are in [AGENTS.md](../AGENTS.md). Endpoint details are in [API.md](API.md).

## Layers

```
Browser  ──►  Next.js 15 (App Router)  ──►  MySQL (Prisma)  ◄──  traj-assigner.js / VMs (traj-runner)
                    │   ▲
                    │   └── PUT /api/fas/[n]  ◄── FAS
                    ├──► FAS (U-Plan, cancel, terms, activation)
                    ├──► Geoawareness service (HTTP uspaces, WebSocket relayed as SSE)
                    └──► MailerSend (transactional email)
```

- **UI**: `app/layout.tsx` is a server component; `app/providers.tsx` is the client shell (i18n, theme, auth, toasts). Pages under `app/(protected)/` (plan-definition, plan-authorization, plan-activation, profile, settings) are guarded once in the group layout. `error`, `global-error`, `not-found` and `loading` are the boundaries.
- **Plan Authorization**: one tree in `app/components/plan-authorization/`. `mode` is `'dev'` or `'prod'` from `NEXT_PUBLIC_PRODUCTION_MODE`; dev is prod plus bulk and researcher tools.
- **Data hooks**: `useFlightPlans` and `useFolders` (in `app/hooks`) call the API through `lib/api-client.ts` and request `?fields=summary` listings. Production Plan Authorization pages them instead (`useFolderPlans`: `?fields=counts` for the folders, 25 plans per expanded folder, server-side search, selected plan by id).
- **API**: route handlers in `app/api/`. Protected ones use `withAuth()` (`lib/auth-middleware.ts`); input is validated with zod 4 schemas from `lib/validators.ts`. All FAS traffic goes through `lib/fas.ts`.
- **Database**: Prisma 5 + MySQL. The schema is shared with processes outside Next.js, so it is an external contract.
- **Standalone processes**: `traj-assigner.js` assigns queued plans to free VMs; `machine-cleaner.js` empties the `machine` table at startup. Both use their own `PrismaClient`.

`flightPlan.csvResult` is a 0/1 flag. The CSV row lives in table `csvResult` under the same primary key as the plan: read it with `plan.id`.

## Processing pipeline

```
sin procesar ─► en cola ─► procesando ─► procesado ─► U-Plan ─► FAS ─► callback
```

1. **sin procesar**: the plan is created (Plan Definition, file upload or external U-Plan).
2. **en cola**: the user sends it to processing (status set through `PUT /api/flightPlans`).
3. **procesando**: `traj-assigner.js` takes the next queued plan, picks a `Disponible` machine, sets the plan to `procesando` and the machine to `Ocupada`. The VM runs traj-runner.
4. **procesado**: the VM writes the `csvResult` row and sets `flightPlan.csvResult = 1`. Failures end in `error`.
5. **U-Plan**: `POST /api/flightPlans/[id]/generate-volumes` builds the 4D volumes (and random placeholder data unless `NEXT_PUBLIC_GENERATE_RANDOM_UPLAN_DATA=false`) into `flightPlan.uplan`.
6. **FAS**: `POST /api/flightPlans/[id]/uplan` sends the U-Plan to `FAS_API_URL` (timeout 120 s) and stores `externalResponseNumber`, `authorizationStatus: pendiente`. A FAS 400 marks the plan `withdrawn`, other 4xx `denegado`; HTTP 500 is retried; unreachable FAS answers 503.
7. **callback**: FAS calls `PUT /api/fas/[externalResponseNumber]` with `{state, message}`. `ACCEPTED` becomes `aprobado`, anything else `denegado`; the owner gets an email.

Afterwards an approved plan can be activated near its `scheduledAt` (`/plan-activation`): terms come from FAS `GET /terms/{n}`, activation calls FAS `GET /activation/{n}`.

## Auth

- Access JWT, 7 days, kept in `localStorage['authToken']`; sent as `Authorization: Bearer`.
- Refresh JWT, 30 days, httpOnly `refreshToken` cookie, used by `POST /api/auth/refresh`. The refresh secret is derived from `JWT_SECRET`.
- `lib/api-client.ts` (`apiFetch`/`apiJson`) retries a 401 once after refreshing the token.
- In production the server refuses to start without `JWT_SECRET` (`instrumentation.ts`).
- Machine endpoints use the shared header `x-machine-api-key` (`MACHINE_API_KEY`). The FAS callback is public; `FAS_CALLBACK_ALLOWED_IPS` optionally restricts it by source IP (right-most `X-Forwarded-For`, set by Caddy).
- Ownership: plans, folders and CSV results are scoped to the token's user. See API.md for the 403/404 behaviour.

## Polling and realtime

- Flight plans: adaptive polling, 3 s while a plan is in a transient state and 15 s otherwise, paused on hidden tabs (`useFlightPlans`, `usePolling`). Errors back off up to 30 s.
- Geoawareness: the server opens the service WebSocket and relays messages unchanged as Server-Sent Events; the client falls back to static geozones after retries.

## i18n and theming

- `app/i18n/`: English (default) and Spanish dictionaries. New strings go in both.
- Tailwind semantic tokens (`tailwind.config.ts`) map to CSS variables in `app/styles/themes.css`. Dark is the default; light sets `data-theme="light"` on `<html>` (toggle in `useTheme`). The Tailwind `dark:` variant follows that attribute, not the OS.

## Deployment

Production runs as 3 Windows instances on the VDS (ports 3002, 3003, 3004) behind Caddy, started with `RUN-UPPS.bat` / `RUN-UPPS_TP.bat` (the latter also starts `machine-cleaner.js` and `traj-assigner.js`). It is not Docker. Each instance has its own `.env`.

On every upgrade, per instance: `npm ci` (native binaries for `bcrypt` 6 and `sharp` 0.35), `npx prisma generate`, `npm run build`, restart. Node >= 20.9 is required. `NEXT_PUBLIC_*` variables are baked in at build time. `MACHINE_API_KEY` is needed only on instances that serve `/api/machine/*`.
