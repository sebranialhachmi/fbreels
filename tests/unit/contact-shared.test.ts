import { describe, expect, it } from 'vitest';
import { contactSchema } from '@/lib/contact';
import { invalidContactFields } from '@/lib/contact-shared';

const base = {
  name: 'أحمد علي',
  email: 'a@example.com',
  type: 'general',
  message: 'رسالة اختبار طويلة بما يكفي.',
};
const serverInvalid = (over: Partial<typeof base>) => {
  const r = contactSchema.safeParse({ ...base, ...over });
  return r.success ? [] : [...new Set(r.error.issues.map((i) => String(i.path[0])))];
};

describe('client validator vs server schema (parity)', () => {
  const emails = [
    'a@example.com',
    'user.name+tag@sub.example.co.uk',
    'ahmad@مثال.السعودية',
    'x@y.zz',
    'a@b',
    'a@b.',
    '@example.com',
    'a@@b.com',
    'a b@example.com',
    'a@exa mple.com',
    'a,b@example.com',
    'a;b@example.com',
    '"a"@example.com',
    '<a@example.com>',
    'a@example..com',
    'a..b@example.com',
    '.a@example.com',
    'a.@example.com',
    'a@-example.com',
    'a@example.com\nBcc: x@y.com',
    '',
    ' ',
    'plainaddress',
    'a@example.c',
    'a@1.2.3.4',
    'a'.repeat(65) + '@example.com',
    'a@' + 'b'.repeat(250) + '.com',
    "o'neil@example.com",
    'a_b@example.com',
  ];

  it('never rejects (on the client) an email the server would accept', () => {
    const wronglyBlocked = emails.filter(
      (email) =>
        invalidContactFields({ ...base, email }).includes('email') &&
        !serverInvalid({ email }).includes('email'),
    );
    expect(wronglyBlocked, JSON.stringify(wronglyBlocked)).toEqual([]);
  });

  it('rejects every obvious injection / malformed address on the client too', () => {
    for (const email of [
      'a@example.com\nBcc: x@y.com',
      'a,b@example.com',
      'a b@example.com',
      '<a@example.com>',
      '"a"@example.com',
      '',
      'plainaddress',
      '@example.com',
      'a@@b.com',
    ]) {
      expect(invalidContactFields({ ...base, email }), email).toContain('email');
      expect(serverInvalid({ email }), email).toContain('email');
    }
  });

  it('agrees exactly on name and message length limits (after trimming and control-char stripping)', () => {
    const cases: [string, string][] = [
      ['', 'name'],
      ['x', 'name'],
      ['xy', 'name'],
      ['x'.repeat(100), 'name'],
      ['x'.repeat(101), 'name'],
      ['  x  ', 'name'],
      ['\u0000\u0007ab', 'name'],
    ];
    for (const [value] of cases)
      expect(invalidContactFields({ ...base, name: value }).includes('name')).toBe(
        serverInvalid({ name: value }).includes('name'),
      );
    for (const value of [
      '',
      'x'.repeat(9),
      'x'.repeat(10),
      'x'.repeat(4000),
      'x'.repeat(4001),
      ' '.repeat(20) + 'short',
      '\u0001'.repeat(30),
    ]) {
      expect(
        invalidContactFields({ ...base, message: value }).includes('message'),
        JSON.stringify(value.slice(0, 12)),
      ).toBe(serverInvalid({ message: value }).includes('message'));
    }
  });

  it('valid input passes on both sides', () => {
    expect(invalidContactFields(base)).toEqual([]);
    expect(serverInvalid({})).toEqual([]);
  });
});
