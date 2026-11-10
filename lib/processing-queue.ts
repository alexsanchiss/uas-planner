import prisma from '@/lib/prisma';

/**
 * Adds `queuePosition` (1-based) and `queueLength` to plan rows: both null unless the row is 'en cola'.
 * The order is exactly the one of traj-assigner.js (scheduledAt asc NULLs last, createdAt asc, id asc) over
 * ALL users' queued plans, so the position is what the assigner will actually do. Costs one id-only query,
 * and only when some row is queued.
 * ponytail: reads every queued id; fine for a queue of up to ~10^4, add a count-based position beyond that.
 */
export async function queueInfo<T extends { id: number; status: string }>(
  rows: T[]
): Promise<Array<T & { queuePosition: number | null; queueLength: number | null }>> {
  if (!rows.some((r) => r.status === 'en cola')) {
    return rows.map((r) => ({ ...r, queuePosition: null, queueLength: null }));
  }
  const queued = await prisma.flightPlan.findMany({
    where: { status: 'en cola' },
    orderBy: [{ scheduledAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  const position = new Map(queued.map((q, i) => [q.id, i + 1]));
  return rows.map((r) => {
    const pos = r.status === 'en cola' ? position.get(r.id) : undefined;
    // A plan that left the queue between the two reads has no position: treated as not queued.
    return { ...r, queuePosition: pos ?? null, queueLength: pos === undefined ? null : queued.length };
  });
}
