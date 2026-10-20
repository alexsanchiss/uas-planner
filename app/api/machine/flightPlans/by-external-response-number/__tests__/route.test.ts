import { NextRequest } from 'next/server';
import { GET } from '../route';

describe('machine lookup with missing path parameter', () => {
  const originalKey = process.env.MACHINE_API_KEY;
  beforeEach(() => { process.env.MACHINE_API_KEY = 'base-route-test-key'; });
  afterAll(() => {
    if (originalKey === undefined) delete process.env.MACHINE_API_KEY;
    else process.env.MACHINE_API_KEY = originalKey;
  });

  it('returns 400 for an authenticated request with no external number', async () => {
    const response = await GET(new NextRequest('http://localhost/api/machine/flightPlans/by-external-response-number/', {
      headers: { 'x-machine-api-key': 'base-route-test-key' },
    }));
    expect(response.status).toBe(400);
  });

  it('requires machine authentication even when the external number is missing', async () => {
    const response = await GET(new NextRequest('http://localhost/api/machine/flightPlans/by-external-response-number/'));
    expect(response.status).toBe(401);
  });
});
