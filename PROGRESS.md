# PROGRESS — UPPS v2.3.0 → v2.4.0

> Orquestador de implementación autónomo. Referencia: `PLAN.md` + `TASKS.md`.
> Baseline: 321 tests ✅ · 7 suites ✅ · `npm run lint` ✅

## Estado general

| Bloque | Release | Estado |
| --- | --- | --- |
| Estabilidad + SCRS | v2.3.0 | ✅ Completo |
| Plan Activation | v2.4.0 | 🔄 En progreso |

---

## v2.3.0

| # | Tarea | Estado | Notas |
| --- | --- | --- | --- |
| T1 | Eliminar logout por inactividad (useAuth.ts) | ✅ | — |
| T2 | SSR-fix DenialMapModal | ✅ | — |
| T3 | lib/scrs.ts + tests | ✅ | 30 tests |
| T4 | lib/qgc-plan.ts + refactor PlanGenerator | ✅ | 23 tests |
| T5 | AlternativeTrajectoryModal | ✅ | — |
| T6 | POST /api/flightPlans/[id]/accept-alternative | ✅ | 6 tests |
| T7 | Integración botón + modal en ActionButtons | ✅ | — |
| T8 | End-to-end manual v2.3.0 | ✅ | lint:0err · 380tests · invariants OK |
| T9 | Release v2.3.0 | ✅ | tag v2.3.0 |

## v2.4.0

| # | Tarea | Estado | Notas |
| --- | --- | --- | --- |
| T10 | Migración Prisma — campos activación | 🔄 | — |
| T11 | GET /api/flightPlans/[id]/terms | ⏳ | blocked: T10 |
| T12 | POST /api/flightPlans/[id]/activate | ⏳ | blocked: T10 |
| T13 | /api/flightPlans/active y /history | ⏳ | blocked: T10 |
| T14 | JsonViewerSections recursivo | 🔄 | — |
| T15 | ActivateFlightModal | ⏳ | blocked: T11, T12, T14 |
| T16 | FlightPlanActivationCard + countdown UI | ⏳ | blocked: T15 |
| T17 | HistoricalFlightPlanList | ⏳ | blocked: T13 |
| T18 | Reemplazo plan-activation/page.tsx | ⏳ | blocked: T16, T17 |
| T19 | useActivationPlans + tick 1s | ⏳ | blocked: T13 |
| T20 | i18n completo Plan Activation | ⏳ | blocked: T18 |
| T21 | End-to-end manual v2.4.0 | ⏳ | blocked: T20 |
| T22 | Release v2.4.0 | ⏳ | blocked: T21 |

---

## Log de commits

| Hash | Mensaje |
| --- | --- |
| 1f5c1de | fix(auth): remove inactivity-based session logout |
| (T2) | fix(ui): make DenialMapModal SSR-safe with dynamic Leaflet imports |
| (T3) | feat(uplan): add SCRS alternative trajectory parser with unit tests |
| (T4) | refactor(uplan): extract QGC plan builder to lib/qgc-plan.ts |
| (T5) | feat(ui): add AlternativeTrajectoryModal for SCRS route proposals |
| (T6) | feat(api): add accept-alternative endpoint for SCRS-proposed routes |
| (T7) | feat(flight-plans): wire alternative trajectory acceptance into authorization modal |
| (T9) | chore(release): v2.3.0 |
