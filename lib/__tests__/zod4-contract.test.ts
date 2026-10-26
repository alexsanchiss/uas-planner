/**
 * Accept/reject contract of the zod schemas reachable from route handlers.
 *
 * Added with the zod 3 -> 4 upgrade (ffadf8a). The expected values were obtained by running the same
 * inputs through zod 3 (`zod/v3`) and zod 4: accept/reject was identical for every case below, so these
 * tests pin the behaviour clients (UI, FAS, email links) already depend on.
 *
 * Only accept/reject, parsed output and the CUSTOM messages that are returned to clients are asserted.
 * zod's built-in default texts changed in v4 ("Required" -> "Invalid input: expected ..."), so they are
 * deliberately not pinned here (see the dedicated test at the bottom).
 */

import {
  signupSchema,
  forgotPasswordSchema,
  resendVerificationSchema,
  verifyEmailSchema,
  resetPasswordSchema,
  idSchema,
  idsArraySchema,
  idParamSchema,
  dateStringSchema,
  folderCreateSchema,
  folderUpdateSchema,
  flightPlanCreateSchema,
  flightPlanUpdateDataSchema,
  flightPlanDeleteSchema,
  externalUplanSchema,
  externalResponseNumberParamSchema,
  safeParseBody,
} from '../validators';
import {
  ContactDetailsSchema,
  FlightDetailsSchema,
  FlightCharacteristicsSchema,
  GeoJSONPointSchema,
} from '../validators/uplan-validator';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success;

describe('email format (signup, forgot-password, resend-verification, verify-email, uplan contact)', () => {
  const accepted = [
    'a@b.com',
    'A@B.COM',
    'user+tag@example.com',
    'user.name@sub.example.co.uk',
    "o'brien@x.es",
    'a_b@x.com',
    'x@alumno.upv.es',
    'a@x.technology',
    'a@xn--and-6ma.es',
  ];
  const rejected = [
    '',
    'noat',
    'a@b',
    'user@localhost',
    'a@b.123',
    'a..b@x.com',
    '.a@x.com',
    ' a@b.com',
    'a@b.com ',
    'user@sub_domain.com',
    'josé@dominio.es',
    'usuario@ñandú.es',
  ];

  it.each(accepted)('accepts %s', (email) => {
    expect(ok(resendVerificationSchema, { email })).toBe(true);
    expect(ok(forgotPasswordSchema, { email })).toBe(true);
    expect(ok(verifyEmailSchema, { email, code: '123456' })).toBe(true);
    expect(ok(ContactDetailsSchema, { firstName: 'A', lastName: 'B', phones: '600', emails: email })).toBe(true);
    expect(ok(ContactDetailsSchema, { firstName: 'A', lastName: 'B', phones: ['600'], emails: [email] })).toBe(true);
  });

  it.each(rejected)('rejects %j', (email) => {
    expect(ok(resendVerificationSchema, { email })).toBe(false);
    expect(ok(forgotPasswordSchema, { email })).toBe(false);
    expect(ok(verifyEmailSchema, { email, code: '123456' })).toBe(false);
    expect(ok(ContactDetailsSchema, { firstName: 'A', lastName: 'B', phones: '600', emails: email })).toBe(false);
  });

  it('keeps the custom message returned to the client', () => {
    const result = safeParseBody(forgotPasswordSchema, { email: 'nope' });

    expect(result).toEqual({
      success: false,
      errors: { formErrors: [], fieldErrors: { email: ['Invalid email address'] } },
    });
  });
});

describe('signup', () => {
  const valid = { email: 'a@b.com', password: '12345678', confirmPassword: '12345678' };

  it('accepts a valid body and strips unknown keys (no privilege escalation through extra fields)', () => {
    const result = signupSchema.safeParse({ ...valid, admin: true, emailVerified: true });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(valid);
  });

  it('reports the custom messages the signup route forwards to the UI', () => {
    const short = signupSchema.safeParse({ ...valid, password: '123', confirmPassword: '1234' });
    expect(short.error?.flatten().fieldErrors).toEqual({
      password: ['Password must be at least 8 characters'],
      confirmPassword: ['Passwords do not match'],
    });

    const mismatch = signupSchema.safeParse({ ...valid, confirmPassword: 'different' });
    expect(mismatch.error?.flatten().fieldErrors).toEqual({ confirmPassword: ['Passwords do not match'] });
  });

  it.each([
    ['null optional field', { ...valid, firstName: null }],
    ['numeric phone', { ...valid, phone: 600123456 }],
    ['missing password', { email: 'a@b.com', confirmPassword: '12345678' }],
  ])('rejects %s', (_label, body) => {
    expect(ok(signupSchema, body)).toBe(false);
  });
});

describe('verify-email / reset-password (email link payloads)', () => {
  it('accepts a token-only body (link flow) and an email+code body (manual flow)', () => {
    expect(verifyEmailSchema.safeParse({ token: 'a3f5-opaque-token' }).data).toEqual({ token: 'a3f5-opaque-token' });
    expect(ok(verifyEmailSchema, { email: 'a@b.com', code: '123456' })).toBe(true);
  });

  it('does not require the token to be a UUID or any other fixed format', () => {
    const uuid = '3b241101-e2bb-4255-8caf-4136c566a962';
    const hex = 'a'.repeat(64); // forgot-password issues 32 random bytes as hex
    expect(ok(verifyEmailSchema, { token: uuid })).toBe(true);
    expect(ok(resetPasswordSchema, { token: hex, newPassword: '12345678' })).toBe(true);
  });

  it.each([
    ['empty body', {}],
    ['5 digit code', { email: 'a@b.com', code: '12345' }],
    ['numeric code', { email: 'a@b.com', code: 123456 }],
    ['empty token', { token: '' }],
    ['numeric token', { token: 5 }],
  ])('rejects %s', (_label, body) => {
    expect(ok(verifyEmailSchema, body)).toBe(false);
  });

  it('enforces the 8 character minimum on reset', () => {
    expect(ok(resetPasswordSchema, { token: 't', newPassword: '1234567' })).toBe(false);
    expect(safeParseBody(resetPasswordSchema, { token: 't', newPassword: '1234567' })).toMatchObject({
      errors: { fieldErrors: { newPassword: ['Password must be at least 8 characters'] } },
    });
  });
});

describe('numeric ids (coerced from path/query strings)', () => {
  it.each([
    [1, 1],
    ['1', 1],
    ['01', 1],
    [' 1', 1],
    ['1e2', 100],
    [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  ])('accepts %j as %d', (input, expected) => {
    expect(idSchema.parse(input)).toBe(expected);
  });

  it.each([0, -1, 1.5, '', null, undefined, false, [], {}, 'abc', 'Infinity', Infinity, -Infinity, NaN])(
    'rejects %j',
    (input) => {
      expect(idSchema.safeParse(input).success).toBe(false);
    },
  );

  it('rejects ids beyond Number.MAX_SAFE_INTEGER (zod 3 silently rounded them)', () => {
    expect(idSchema.safeParse(Number.MAX_SAFE_INTEGER + 1).success).toBe(false);
    expect(idSchema.safeParse('9007199254740993').success).toBe(false);
  });

  it('applies the same rules inside objects and arrays', () => {
    expect(idParamSchema.parse({ id: '7' })).toEqual({ id: 7 });
    expect(idsArraySchema.parse(['1', 2])).toEqual([1, 2]);
    expect(ok(idsArraySchema, [])).toBe(false);
    expect(ok(idsArraySchema, [1, 0])).toBe(false);
  });
});

describe('dates (scheduledAt, min/maxScheduledAt)', () => {
  it.each([
    '2026-01-01T10:00:00Z',
    '2026-01-01T10:00:00.123Z',
    '2026-01-01T10:00:00.123456789Z',
    '2026-01-01T10:00:00+02:00', // accepted through the Date.parse fallback, not by .datetime()
    '2026-01-01T10:00:00',
    '2026-01-01',
  ])('accepts %s', (value) => {
    expect(dateStringSchema.safeParse(value).success).toBe(true);
  });

  it.each(['garbage', '', null, undefined, 123])('rejects %j', (value) => {
    expect(dateStringSchema.safeParse(value).success).toBe(false);
  });

  it('treats null/absent scheduling bounds as optional on folders', () => {
    expect(ok(folderCreateSchema, { name: 'n', userId: 1, minScheduledAt: null, maxScheduledAt: null })).toBe(true);
    expect(ok(folderCreateSchema, { name: 'n', userId: 1 })).toBe(true);
    expect(ok(folderCreateSchema, { name: 'n', userId: 1, minScheduledAt: 'garbage' })).toBe(false);
  });
});

describe('update / delete payloads', () => {
  it('rejects an update that carries no known field (unknown keys are stripped first)', () => {
    expect(safeParseBody(flightPlanUpdateDataSchema, {})).toMatchObject({
      success: false,
      errors: { formErrors: ['At least one field must be provided for update'] },
    });
    expect(ok(flightPlanUpdateDataSchema, { notAField: 1 })).toBe(false);
    expect(ok(folderUpdateSchema, {})).toBe(false);
    expect(ok(folderUpdateSchema, { notAField: 1 })).toBe(false);
  });

  it('accepts partial updates, explicit nulls and strips unknown keys', () => {
    expect(flightPlanUpdateDataSchema.parse({ customName: 'x', hacked: true })).toEqual({ customName: 'x' });
    expect(flightPlanUpdateDataSchema.parse({ uplan: null, csvResult: null })).toEqual({
      uplan: null,
      csvResult: null,
    });
  });

  it('does not coerce numeric strings where the schema expects a number', () => {
    expect(ok(flightPlanUpdateDataSchema, { csvResult: '5' })).toBe(false);
    expect(ok(flightPlanUpdateDataSchema, { machineAssignedId: 0 })).toBe(false);
  });

  it('requires id or ids when deleting', () => {
    expect(safeParseBody(flightPlanDeleteSchema, {})).toMatchObject({
      success: false,
      errors: { formErrors: ['Either id or ids must be provided'] },
    });
    expect(flightPlanDeleteSchema.parse({ ids: [1, '2'] })).toEqual({ ids: [1, 2] });
    expect(ok(flightPlanDeleteSchema, { id: 3 })).toBe(true);
  });

  it('coerces userId but not folderId/status when creating a plan', () => {
    const base = { customName: 'n', status: 'en cola', fileContent: 'x', userId: '5' };
    expect(flightPlanCreateSchema.parse({ ...base, folderId: null, scheduledAt: null })).toMatchObject({
      userId: 5,
      folderId: null,
      scheduledAt: null,
    });
    expect(ok(flightPlanCreateSchema, { ...base, status: 'bogus' })).toBe(false);
    expect(ok(flightPlanCreateSchema, { ...base, customName: 'n'.repeat(256) })).toBe(false);
  });
});

describe('externalUplanSchema (POST /api/flightPlans, external import)', () => {
  const body = {
    type: 'external_uplan',
    uplan: { operationVolumes: [{ timeBegin: '2026-01-01T10:00:00Z', geometry: { any: 'shape' } }], bar: 2 },
    folderId: '3',
    customName: 'Imported',
  };

  it('keeps unknown keys inside uplan and its volumes (passthrough) but strips them at the top level', () => {
    const parsed = externalUplanSchema.parse({ ...body, extra: true });

    expect(parsed).toEqual({ ...body, folderId: 3 });
    expect(parsed).not.toHaveProperty('extra');
  });

  it.each([
    ['no volumes', { ...body, uplan: { operationVolumes: [] } }],
    ['wrong type literal', { ...body, type: 'uplan' }],
    ['null timeBegin', { ...body, uplan: { operationVolumes: [{ timeBegin: null }] } }],
    ['missing folderId', { ...body, folderId: undefined }],
  ])('rejects %s', (_label, input) => {
    expect(ok(externalUplanSchema, input)).toBe(false);
  });

  it('accepts a volume without timeBegin', () => {
    expect(ok(externalUplanSchema, { ...body, uplan: { operationVolumes: [{}] } })).toBe(true);
  });
});

describe('FAS path parameter', () => {
  it('accepts any non-empty external response number, whatever its format', () => {
    for (const externalResponseNumber of ['EXT-001', '12345', '3b241101-e2bb-4255-8caf-4136c566a962', 'a b']) {
      expect(ok(externalResponseNumberParamSchema, { externalResponseNumber })).toBe(true);
    }
    expect(ok(externalResponseNumberParamSchema, { externalResponseNumber: '' })).toBe(false);
    expect(ok(externalResponseNumberParamSchema, { externalResponseNumber: 123 })).toBe(false);
  });
});

describe('uplan-validator (client-side form validation)', () => {
  const flightDetails = { mode: 'VLOS', category: 'OPENA1', specialOperation: '' };

  it('defaults privateFlight to false when absent/null and coerces "true" and 1', () => {
    expect(FlightDetailsSchema.parse(flightDetails).privateFlight).toBe(false);
    expect(FlightDetailsSchema.parse({ ...flightDetails, privateFlight: null }).privateFlight).toBe(false);
    expect(FlightDetailsSchema.parse({ ...flightDetails, privateFlight: 'true' }).privateFlight).toBe(true);
    expect(FlightDetailsSchema.parse({ ...flightDetails, privateFlight: 1 }).privateFlight).toBe(true);
  });

  it('requires 3D GeoJSON waypoints [lon, lat, alt]', () => {
    const wp = (coordinates: number[]) => ({ ...flightDetails, waypoints: [{ type: 'Point', coordinates }] });

    expect(ok(FlightDetailsSchema, wp([-0.37, 39.48, 10]))).toBe(true);
    expect(ok(FlightDetailsSchema, wp([-0.37, 39.48]))).toBe(false);
    expect(ok(FlightDetailsSchema, wp([-0.37, 39.48, 10, 1]))).toBe(false);
    expect(ok(FlightDetailsSchema, wp([-0.37, 39.48, Infinity]))).toBe(false);
  });

  it('accepts numeric strings for UAS characteristics but rejects empty, non-numeric and non-positive values', () => {
    const fc = { uasMTOM: 2, uasMaxSpeed: '5', Connectivity: 'RF', idTechnology: 'NRID', maxFlightTime: '30' };

    expect(FlightCharacteristicsSchema.parse(fc)).toMatchObject({ uasMTOM: 2, uasMaxSpeed: 5, maxFlightTime: 30 });
    for (const bad of ['', 'abc', -1, 0, null, Infinity]) {
      expect(ok(FlightCharacteristicsSchema, { ...fc, uasMTOM: bad })).toBe(false);
    }
    expect(ok(FlightCharacteristicsSchema, { ...fc, uasMTOM: undefined })).toBe(false);
  });

  it('rejects non-finite coordinates in GeoJSON points', () => {
    expect(ok(GeoJSONPointSchema, { type: 'Point', coordinates: [1, 2] })).toBe(true);
    expect(ok(GeoJSONPointSchema, { type: 'Point', coordinates: [1, Infinity] })).toBe(false);
    expect(ok(GeoJSONPointSchema, { type: 'Point', coordinates: [1, 2], properties: null })).toBe(false);
  });
});

describe('error shape returned by safeParseBody', () => {
  it('is still the flatten() shape { formErrors, fieldErrors } the UI and API docs rely on', () => {
    const result = safeParseBody(forgotPasswordSchema, {});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(result.errors).sort()).toEqual(['fieldErrors', 'formErrors']);
      expect(result.errors.formErrors).toEqual([]);
      // Default (non-custom) texts are zod's own and differ between major versions; assert only that
      // one string message is reported per missing field.
      expect(result.errors.fieldErrors.email).toEqual([expect.any(String)]);
    }
  });
});
