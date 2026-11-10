/**
 * Per-plan simulation settings and processing-error format. Pure (no React, no Prisma), shared by
 * the API (PUT /api/flightPlans/simulation, validators) and the UI. The columns are written by the
 * UI (simAirframe, wind*) and by the traj-runner (progress, processingEta, processingError); see docs/API.md.
 */

export type Airframe = 'multirotor' | 'fixedwing';

export interface WindSettings {
  /** Mean wind in m/s (> 0). */
  speed: number;
  /** Degrees 0-359, direction the wind blows FROM, clockwise from north. */
  direction: number;
  /** Maximum gust in m/s (>= speed), or null for constant wind. */
  gust: number | null;
}

export interface SimulationSettings {
  airframe: Airframe;
  /** null = no wind. */
  wind: WindSettings | null;
}

export const WIND_SPEED_MAX = 30;
export const WIND_GUST_MAX = 40;

/** Settings stored in a plan row. NULL airframe = multirotor; windSpeed NULL/0 = no wind. */
export function simulationOf(row: {
  simAirframe?: string | null;
  windSpeed?: number | null;
  windDirection?: number | null;
  windGust?: number | null;
}): SimulationSettings {
  const airframe: Airframe = row.simAirframe === 'fixedwing' ? 'fixedwing' : 'multirotor';
  const speed = row.windSpeed ?? 0;
  if (!(speed > 0)) return { airframe, wind: null };
  return { airframe, wind: { speed, direction: row.windDirection ?? 0, gust: row.windGust ?? null } };
}

export const PROCESSING_ERROR_CODES = [
  'no_plan_file',
  'invalid_plan',
  'px4_start',
  'mission_rejected',
  'takeoff_failed',
  'timeout',
  'incomplete',
  'internal',
] as const;
export type ProcessingErrorCode = (typeof PROCESSING_ERROR_CODES)[number];

/** Parse `processingError` ("<code>: <detail>"). Unknown or absent code -> code null, detail = whole text. */
export function parseProcessingError(
  text: string | null
): { code: ProcessingErrorCode | null; detail: string } | null {
  if (text === null || text === undefined) return null;
  const i = text.indexOf(':');
  if (i > 0) {
    const code = text.slice(0, i).trim();
    if ((PROCESSING_ERROR_CODES as readonly string[]).includes(code)) {
      return { code: code as ProcessingErrorCode, detail: text.slice(i + 1).trim() };
    }
  }
  return { code: null, detail: text };
}
