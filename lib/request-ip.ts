/**
 * Client source IP behind the trusted reverse proxy (Caddy): the RIGHT-MOST
 * X-Forwarded-For entry (the one the proxy appended itself; earlier entries are
 * client-controlled), else X-Real-IP. Null when neither is present.
 * Only trustworthy if all traffic goes through the proxy (not direct to :3003).
 * Kept out of lib/http.ts so importing it does not pull in Prisma.
 */
export function getSourceIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for')?.split(',').pop()?.trim();
  const ip = forwarded || headers.get('x-real-ip')?.trim();
  return ip ? ip.replace(/^::ffff:/i, '') : null;
}
