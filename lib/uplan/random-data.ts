/**
 * NEXT_PUBLIC_GENERATE_RANDOM_UPLAN_DATA: random placeholder U-Plan data is generated unless
 * the variable is exactly 'false' (documented default: enabled). Used by server and client;
 * keep the literal `process.env.NEXT_PUBLIC_...` access so Next inlines it in the browser bundle.
 */
export function shouldGenerateRandomUplan(): boolean {
  return process.env.NEXT_PUBLIC_GENERATE_RANDOM_UPLAN_DATA !== 'false'
}
