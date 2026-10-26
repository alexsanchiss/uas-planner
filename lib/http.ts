import prisma from '@/lib/prisma';

/** Parse and validate a numeric resource ID from route params (positive integer or null). */
export function parseId(idParam: string): number | null {
  const id = parseInt(idParam, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Client source IP behind the trusted reverse proxy (Caddy): the RIGHT-MOST
 * X-Forwarded-For entry (the one the proxy appended itself; earlier entries are
 * client-controlled), else X-Real-IP. Null when neither is present.
 * Only trustworthy if all traffic goes through the proxy (not direct to :3003).
 */
export function getSourceIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for')?.split(',').pop()?.trim();
  const ip = forwarded || headers.get('x-real-ip')?.trim();
  return ip ? ip.replace(/^::ffff:/i, '') : null;
}

/**
 * True when every given folder id exists and belongs to `userId`
 * (null/undefined entries mean "no folder" and are ignored).
 */
export async function userOwnsFolders(
  userId: number,
  folderIds: Array<number | null | undefined>
): Promise<boolean> {
  const wanted = [...new Set(folderIds.filter((x): x is number => typeof x === 'number'))];
  if (wanted.length === 0) return true;
  const owned = await prisma.folder.count({ where: { id: { in: wanted }, userId } });
  return owned === wanted.length;
}
