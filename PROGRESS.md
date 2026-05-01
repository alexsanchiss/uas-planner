# PROGRESS — UPPS v2.3.0 → v2.4.0

> Orquestador de implementación autónomo. Referencia: `PLAN.md` + `TASKS.md`.
> Baseline: 321 tests ✅ · 7 suites ✅ · `npm run lint` ✅

## Estado general

| Bloque | Release | Estado |
| --- | --- | --- |
| Estabilidad + SCRS | v2.3.0 | 🔄 En progreso |
| Plan Activation | v2.4.0 | ⏳ Pendiente |

---

## v2.3.0

| # | Tarea | Estado | Notas |
| --- | --- | --- | --- |
| T1 | Eliminar logout por inactividad (useAuth.ts) | ✅ | — |
| T2 | SSR-fix DenialMapModal | ✅ | — |
| T3 | lib/scrs.ts + tests | ✅ | — |
| T4 | lib/qgc-plan.ts + refactor PlanGenerator | ✅ | — |
| T5 | AlternativeTrajectoryModal | ⏳ | blocked: T3 |
| T6 | POST /api/flightPlans/[id]/accept-alternative | ⏳ | blocked: T3, T4 |
| T7 | Integración botón + modal en ActionButtons | ⏳ | blocked: T5, T6 |
| T8 | End-to-end manual v2.3.0 | ⏳ | blocked: T1, T2, T7 |
| T9 | Release v2.3.0 | ⏳ | blocked: T8 |

## v2.4.0

| # | Tarea | Estado | Notas |
| --- | --- | --- | --- |
| T10 | Migración Prisma — campos activación | ⏳ | — |
| T11 | GET /api/flightPlans/[id]/terms | ⏳ | blocked: T10 |
| T12 | POST /api/flightPlans/[id]/activate | ⏳ | blocked: T10 |
| T13 | /api/flightPlans/active y /history | ⏳ | blocked: T10 |
| T14 | JsonViewerSections recursivo | ⏳ | — |
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

_(se llena a medida que se completan tareas)_
