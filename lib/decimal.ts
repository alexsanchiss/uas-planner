/**
 * Parses a decimal typed by a user, accepting "." or "," as the single decimal separator.
 * Returns NaN when invalid: empty, letters, exponents, two separators or inner spaces.
 * Numbers pass through when finite.
 */
export function parseDecimal(raw: string | number): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : NaN;
  const s = raw.trim();
  if (!/^[+-]?(\d+[.,]?\d*|[.,]\d+)$/.test(s)) return NaN;
  return Number(s.replace(",", "."));
}
