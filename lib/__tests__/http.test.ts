/**
 * lib/http.ts: parseId, getSourceIp (the one client-IP rule shared by rate limits and the FAS callback
 * allowlist) and userOwnsFolders (the folder-ownership primitive behind SEC-06).
 * The prisma fake counts folders honouring `where`, so a missing userId filter is caught.
 */

const mockFolderCount = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { folder: { count: (...a: unknown[]) => mockFolderCount(...a) } },
}));

import { getSourceIp, parseId, userOwnsFolders } from '../http';

const FOLDERS = [
  { id: 1, userId: 10 },
  { id: 2, userId: 10 },
  { id: 3, userId: 20 },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockFolderCount.mockImplementation(async ({ where }: { where: { id: { in: number[] }; userId: number } }) =>
    FOLDERS.filter((f) => where.id.in.includes(f.id) && f.userId === where.userId).length,
  );
});

describe('parseId', () => {
  it.each([
    ['1', 1],
    ['42', 42],
  ])('parses %s -> %d', (input, expected) => {
    expect(parseId(input)).toBe(expected);
  });

  it.each(['0', '-3', 'abc', '', 'NaN', 'Infinity'])('rejects %j', (input) => {
    expect(parseId(input)).toBeNull();
  });
});

describe('userOwnsFolders', () => {
  it('is true without touching the DB when no folder is involved', async () => {
    await expect(userOwnsFolders(10, [])).resolves.toBe(true);
    await expect(userOwnsFolders(10, [null, undefined, null])).resolves.toBe(true);
    expect(mockFolderCount).not.toHaveBeenCalled();
  });

  it('is true when every folder is the caller\'s, deduplicating ids', async () => {
    await expect(userOwnsFolders(10, [1, 2, 1, null])).resolves.toBe(true);
    expect(mockFolderCount).toHaveBeenCalledWith({ where: { id: { in: [1, 2] }, userId: 10 } });
  });

  it('is false if any folder belongs to someone else, even among own ones', async () => {
    await expect(userOwnsFolders(10, [3])).resolves.toBe(false);
    await expect(userOwnsFolders(10, [1, 2, 3])).resolves.toBe(false);
    await expect(userOwnsFolders(20, [1])).resolves.toBe(false);
  });

  it('is false for a folder that does not exist', async () => {
    await expect(userOwnsFolders(10, [999])).resolves.toBe(false);
    await expect(userOwnsFolders(10, [1, 999])).resolves.toBe(false);
  });
});

describe('getSourceIp (right-most X-Forwarded-For: the entry the trusted proxy appended)', () => {
  const ip = (headers: Record<string, string>) => getSourceIp(new Headers(headers));

  it('takes the RIGHT-most entry: everything to its left is client-controlled', () => {
    expect(ip({ 'x-forwarded-for': '203.0.113.7' })).toBe('203.0.113.7');
    expect(ip({ 'x-forwarded-for': '10.0.0.5, 198.51.100.9' })).toBe('198.51.100.9');
    expect(ip({ 'x-forwarded-for': ' 1.1.1.1 ,  2.2.2.2 , 198.51.100.9 ' })).toBe('198.51.100.9');
  });

  it('X-Forwarded-For wins over X-Real-IP; X-Real-IP is only the fallback', () => {
    expect(ip({ 'x-forwarded-for': '198.51.100.9', 'x-real-ip': '10.0.0.5' })).toBe('198.51.100.9');
    expect(ip({ 'x-real-ip': ' 10.0.0.5 ' })).toBe('10.0.0.5');
  });

  it('strips the ::ffff: IPv4-mapped prefix, case-insensitively, from either header', () => {
    expect(ip({ 'x-forwarded-for': '::ffff:198.51.100.9' })).toBe('198.51.100.9');
    expect(ip({ 'x-forwarded-for': '1.1.1.1, ::FFFF:198.51.100.9' })).toBe('198.51.100.9');
    expect(ip({ 'x-real-ip': '::ffff:10.0.0.5' })).toBe('10.0.0.5');
  });

  it('is null when no header carries an address', () => {
    expect(ip({})).toBeNull();
    expect(ip({ 'x-forwarded-for': '' })).toBeNull();
  });
});
