/**
 * Adaptive polling of useFlightPlans (F7a): the interval function lives inline in the hook and the
 * visibility pause lives in usePolling (document listener + effects), neither testable without a DOM, so
 * only the pure parts that decide them are pinned here: which plans count as "transient" (poll fast) and
 * the two intervals. usePolling's visibility/pause behaviour is covered by the browser smoke (R4).
 */

import { isTransientPlan, POLL_FAST_MS, POLL_IDLE_MS } from '../useFlightPlans';

describe('isTransientPlan', () => {
  it.each([
    ['en cola', 'sin autorización'],
    ['procesando', 'sin autorización'],
    ['procesado', 'pendiente'],
    ['procesado', 'procesando autorización'],
  ])('status=%s auth=%s polls fast', (status, auth) => {
    expect(isTransientPlan({ status, authorizationStatus: auth })).toBe(true);
  });

  it.each([
    ['sin procesar', 'sin autorización'],
    ['procesado', 'sin autorización'],
    ['procesado', 'aprobado'],
    ['procesado', 'denegado'],
    ['procesado', 'withdrawn'],
    ['error', 'sin autorización'],
  ])('status=%s auth=%s is idle', (status, auth) => {
    expect(isTransientPlan({ status, authorizationStatus: auth })).toBe(false);
  });

  it('a missing authorizationStatus is not transient on its own', () => {
    expect(isTransientPlan({ status: 'procesado' })).toBe(false);
    expect(isTransientPlan({ status: 'procesado', authorizationStatus: null })).toBe(false);
  });

  it('polls faster while something is in progress than when idle', () => {
    expect(POLL_FAST_MS).toBeLessThan(POLL_IDLE_MS);
    expect(POLL_FAST_MS).toBeGreaterThan(0);
  });
});
