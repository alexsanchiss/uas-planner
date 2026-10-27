jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { flightPlan: { findFirst: jest.fn() } },
}));

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { GET } from '../route';

const findFirst = prisma.flightPlan.findFirst as jest.Mock;
const originalKey = process.env.MACHINE_API_KEY;
const key = 'machine-test-key-only';

function request(headers: Record<string, string> = { 'x-machine-api-key': key }) {
  return new NextRequest('http://localhost/api/machine/flightPlans/by-external-response-number/EXT-001', { headers });
}

function context(externalResponseNumber = 'EXT-001') {
  return { params: Promise.resolve({ externalResponseNumber }) };
}

beforeEach(() => {
  jest.resetAllMocks();
  process.env.MACHINE_API_KEY = key;
});

afterAll(() => {
  if (originalKey === undefined) delete process.env.MACHINE_API_KEY;
  else process.env.MACHINE_API_KEY = originalKey;
});

describe('GET machine flight plan by external response number', () => {
  it('returns the plan customName, querying the external number rather than the plan ID', async () => {
    findFirst.mockResolvedValue({ customName: 'Misión Valencia 02' });

    const response = await GET(request(), context('EXT-001'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ customName: 'Misión Valencia 02' });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { externalResponseNumber: 'EXT-001' },
      select: { customName: true },
    }));
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it.each<Record<string, string>>([
    {},
    { 'x-machine-api-key': 'wrong-key' },
    { 'x-api-key': key },
    { Authorization: `Bearer ${key}` },
  ])('rejects missing or incorrect machine credentials before querying (%j)', async headers => {
    const response = await GET(request(headers), context());

    expect(response.status).toBe(401);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it.each(['', '   ', 'x'.repeat(256)])('rejects invalid external number before querying', async value => {
    const response = await GET(request(), context(value));

    expect(response.status).toBe(400);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('returns 404 when no plan has the requested external number', async () => {
    findFirst.mockResolvedValue(null);

    const response = await GET(request(), context());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('returns 500 without exposing database error details', async () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    findFirst.mockRejectedValue(new Error('private database connection details'));
    try {
      const response = await GET(request(), context());
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual(expect.objectContaining({ error: expect.any(String) }));
      expect(JSON.stringify(body)).not.toContain('private database');
    } finally {
      errorLog.mockRestore();
    }
  });
});
