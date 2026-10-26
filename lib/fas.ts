/**
 * Single home for the FAS (Flight Authorization Service) client helpers.
 *
 * The env var is read lazily (inside the functions) so tests and builds without
 * env keep working and a changed env is honoured without a re-import.
 */

/** Production default; kept byte-identical to the historical per-route copies. */
const DEFAULT_FAS_API_URL = 'http://158.42.167.56:8000/uplan';

/** Timeout for every outbound FAS request except the U-Plan POST. */
export const FAS_TIMEOUT_MS = 30_000;

/**
 * Timeout for the U-Plan POST. Longer on purpose: FAS may register the plan and answer
 * late, and aborting early would make the user's retry create a duplicate authorization.
 */
export const FAS_UPLAN_TIMEOUT_MS = 120_000;

/** Full FAS U-Plan endpoint (POST target). */
export function getFasApiUrl(): string {
  return process.env.FAS_API_URL || DEFAULT_FAS_API_URL;
}

/**
 * FAS base URL (protocol + host, path discarded), e.g.
 * "http://158.42.167.56:8000/uplan" -> "http://158.42.167.56:8000".
 */
export function getFasBaseUrl(): string {
  const apiUrl = getFasApiUrl();
  try {
    const url = new URL(apiUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return apiUrl.replace(/\/uplan\/?$/, '');
  }
}

/** `fetch` against FAS with the shared timeout (aborts with a TimeoutError). */
export function fasFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(FAS_TIMEOUT_MS) });
}

/**
 * Send a cancellation request to FAS for an approved flight plan.
 * Failures (including timeouts) are logged, never thrown: callers never block on FAS.
 */
export async function sendFasCancellation(externalResponseNumber: string): Promise<void> {
  const cancelUrl = `${getFasBaseUrl()}/uplan_cancelation/${encodeURIComponent(externalResponseNumber)}`;

  try {
    const response = await fasFetch(cancelUrl, { method: 'DELETE' });
    if (!response.ok) {
      console.warn(
        `[FAS Cancellation] Non-OK response for ${externalResponseNumber}: ${response.status} ${response.statusText}`
      );
    }
  } catch (error) {
    console.warn(
      `[FAS Cancellation] Failed to cancel ${externalResponseNumber}:`,
      error instanceof Error ? error.message : error
    );
  }
}
