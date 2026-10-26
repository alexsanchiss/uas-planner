# AGENTS.md

Canonical instructions for any coding agent (Claude Code, Codex, Copilot) working in this repo. `CLAUDE.md` and `.github/copilot-instructions.md` only point here.

## What this is

UPPS: web app for drone operators. Users define or upload flight plans, trajectories are computed on external VMs, the U-Plan is sent to FAS (Flight Authorization Service) for authorization, then the flight is activated.
Next.js 15.5 App Router, React 18, TypeScript, Tailwind 3, Prisma 5 + MySQL, zod 4, JWT, Jest. Node >= 20.9 (`engines`).

## Orientation first

`graphify-out/` (git-ignored) holds the code graph. Run `graphify query "<question>"` before grepping raw code. After code changes run `graphify update .`. If the folder is missing: `graphify . --code-only`.

## Map

```
app/layout.tsx, providers.tsx   server root layout + client shell (i18n, theme, auth, toasts)
app/(protected)/                route group, guarded once in its layout: plan-definition, plan-authorization,
                                plan-activation, profile, settings (URLs unchanged)
app/error|global-error|not-found|loading.tsx   boundaries
app/api/                        route handlers (inventory and contracts: docs/API.md)
app/components/plan-authorization/   the ONE Plan Authorization tree; mode 'dev'|'prod'
app/components/{plan-definition,plan-activation,flight-plans,auth,ui}/   feature components; ui/ = Base UI primitives
app/hooks/                      useFlightPlans / useFolders (?fields=summary), usePolling, useAuth, useTheme ...
app/i18n/                       en (default) / es dictionaries; add every user-facing string to both
app/styles/themes.css           CSS variables behind the Tailwind semantic tokens (tailwind.config.ts)
lib/                            auth.ts, auth-middleware.ts, api-client.ts, fas.ts, request-ip.ts, validators.ts,
                                zod-config.ts, email.ts, cesium-loader.ts, scan-generator.ts, scrs.ts, uplan/
prisma/schema.prisma            MySQL schema (shared with external processes, see Contracts)
traj-assigner.js, machine-cleaner.js   standalone Node processes, outside Next.js
Traj-runner/                    VM image/entrypoint for the trajectory runner
docs/                           ARCHITECTURE.md, API.md, icd/ (ICD v2.4.0 .tex/.pdf, do not edit), requirements/
tasks/                          local only (git-excluded): todo.md plan, lessons.md, audit/ reports, runs/ evidence
```

## Commands

```bash
npm ci                                   # install (postinstall runs copy-cesium)
npm run dev                              # http://localhost:3003 (also `start`)
npm run typecheck                        # tsc --noEmit
npm run lint                             # ESLint 9 flat config (eslint.config.mjs)
npm test                                 # Jest, all tests
npm test -- --testPathPattern=<name>     # single test file
npm run test:watch | test:coverage
npm run build                            # runs prebuild copy-cesium; does NOT lint
npm run copy-cesium                      # regenerate public/cesium (generated, do not edit or commit by hand)
npx prisma validate | generate | migrate dev | studio
node traj-assigner                       # trajectory dispatcher, separate from Next.js
node machine-cleaner                     # empties the machine table (run at VDS startup)
```

The local `.env` `DATABASE_URL` may point to a remote DB that dev machines cannot reach: pure tests do not need it; for DB work use a local MySQL. Variables: `.env.example` is the single list.

## Modes and flags

- `NEXT_PUBLIC_PRODUCTION_MODE` selects the Plan Authorization mode: `dev` = `prod` + bulk and researcher tools. Same component tree, no second copy.
- `NEXT_PUBLIC_GENERATE_RANDOM_UPLAN_DATA`: random U-Plan placeholder data is ON unless it is `'false'` (helper: `lib/uplan/random-data.ts`, use it, do not re-read the env var).
- `NEXT_PUBLIC_*` values are inlined at build time: changing one needs a new `next build`.

## Contracts that must not change

Other systems depend on these. Change them only with explicit owner approval and update `docs/API.md`.

- FAS callback `PUT /api/fas/[externalResponseNumber]`: public, no JWT. Optional `FAS_CALLBACK_ALLOWED_IPS` allowlist uses the right-most `X-Forwarded-For` (Caddy in front).
- `/api/machine/*` (header `x-machine-api-key`) and every outbound FAS call (`lib/fas.ts`).
- Geoawareness service calls and the SSE relay under `/api/geoawareness/*`.
- The MySQL schema: VMs/traj-runner, `traj-assigner.js` and `machine-cleaner.js` read and write it directly. Do not rename tables, columns or status values.
- Email links `/verify-email?token=` and `/reset-password?token=`.
- Browser persistence: localStorage key `authToken` and the httpOnly `refreshToken` cookie.

Full list with shapes: `docs/API.md`.

## Gotchas

- `flightPlan.csvResult` is a 0/1 flag, not an id. The CSV row shares the plan's primary key: fetch it with `plan.id`.
- Auth: access JWT 7 d in localStorage `authToken`, refresh JWT 30 d in an httpOnly cookie (`lib/auth.ts`). Client calls go through `apiFetch`/`apiJson` in `lib/api-client.ts` (one refresh retry). Protected routes use `withAuth()`.
- `?fields=summary` on `GET /api/flightPlans` and `/api/folders` returns light rows (no `fileContent`/`uplan`); detail comes from `GET /api/flightPlans/[id]`.
- Statuses: `sin procesar` -> `en cola` -> `procesando` -> `procesado` | `error`. Authorization: `sin autorización`, `pendiente`, `aprobado`, `denegado`, `withdrawn`.
- All FAS access goes through `lib/fas.ts` (timeout 30 s; U-Plan POST 120 s). Client IP behind the proxy: `lib/request-ip.ts`. Cesium loading: `lib/cesium-loader.ts`.
- Styling: use semantic Tailwind tokens, never hardcoded hex. Dark variant follows the app toggle (`data-theme`), not the OS.
- zod 4 is configured in `lib/zod-config.ts`; import schemas from `lib/validators.ts`.
- `next build` does not lint. CI does, so run `npm run lint` yourself.
- `instrumentation.ts` aborts startup in production without `JWT_SECRET`.
- Production is 3 Windows instances on the VDS (ports 3002/3003/3004 behind Caddy), not Docker. `Dockerfile`/`docker-compose.yml` are not the deploy path.
- Never commit secrets or `.env*` files.
- One `next build`/`next dev` per checkout at a time: they share `.next`. Parallel agents stop at typecheck/lint/jest; browser smoke uses `next start -p 3013`, never the production port.

## Working as an agent here

Non-trivial work: plan in `tasks/todo.md` with acceptance checks, then implement, verify, and log corrections in `tasks/lessons.md` (failure, signal, rule). Never `git stash`/`reset`/`checkout` in a tree that holds someone else's uncommitted changes. Never trigger real FAS actions (request authorization, activate, terms) while testing.

## Definition of done

Run and cite the output of: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. CI (`.github/workflows/ci.yml`) runs `npm ci`, `prisma validate/generate`, typecheck, lint, jest, build, `npm audit`. Dependabot: `.github/dependabot.yml`.

Tests live in `__tests__/` next to the code, named `*.test.ts`. Jest runs in the `node` environment without jsdom: write pure tests (logic, helpers, route handlers), not component rendering.

## Commits

Conventional Commits: `type(scope): summary`. Types: feat, fix, refactor, test, docs, chore, build, ci. Scopes: `api`, `ui`, `auth`, `db`, `flight-plans`, `scan`, `uplan`, `deps`, `ci`. Do not commit unless asked.

## Deploy

Operator notes (per-instance `npm ci`, env, Caddy) are in `docs/ARCHITECTURE.md` and the latest `CHANGELOG.md` entry. Secrets live in each instance's `.env`, never in the repo.
