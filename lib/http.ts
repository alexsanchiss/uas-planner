import prisma from '@/lib/prisma';

/** Parse and validate a numeric resource ID from route params (positive integer or null). */
export function parseId(idParam: string): number | null {
  const id = parseInt(idParam, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
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
