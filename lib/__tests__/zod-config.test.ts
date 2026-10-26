/**
 * lib/zod-config.ts: zod 4 changed the text for a missing value from "Required" to
 * "Invalid input: expected string, received undefined". The UI forms and the 400 bodies show it,
 * so the validator modules import zod-config to restore it. Explicit messages must win.
 */

import { z } from 'zod';
import '../zod-config';
import { loginSchema } from '../validators';

const messages = (r: { success: boolean; error?: { issues: Array<{ message: string }> } }) =>
  r.error?.issues.map((i) => i.message) ?? [];

describe('zod-config (customError)', () => {
  it('says "Required" for a missing value, top level and as an object field', () => {
    expect(messages(z.string().safeParse(undefined))).toEqual(['Required']);
    expect(messages(z.object({ a: z.string() }).safeParse({}))).toEqual(['Required']);
  });

  it('keeps the zod default text for a present value of the wrong type', () => {
    const [m] = messages(z.string().safeParse(5));
    expect(m).not.toBe('Required');
    expect(m).toMatch(/expected string/i);
    expect(messages(z.string().safeParse(null))[0]).not.toBe('Required');
  });

  it('never overrides an explicit message (schema-level or check-level)', () => {
    expect(messages(z.string('Email is mandatory').safeParse(undefined))).toEqual(['Email is mandatory']);
    expect(messages(z.string().min(3, 'Too short').safeParse('ab'))).toEqual(['Too short']);
  });

  it('is applied by the real validator module: a missing login field reports "Required"', () => {
    expect(messages(loginSchema.safeParse({}))).toEqual(['Required', 'Required']);
    // a present-but-invalid value still reports the validator's own explicit message
    expect(messages(loginSchema.safeParse({ email: 'nope', password: 'x' }))).toEqual(['Invalid email address']);
  });
});
