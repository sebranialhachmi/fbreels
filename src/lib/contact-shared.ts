/**
 * Contact-form constants and a dependency-free validator shared by the browser and the server.
 * The browser uses this (so the zod library is NOT shipped to visitors); the server remains authoritative and
 * re-validates everything with the zod schema in `contact.ts`. A parity test guarantees the client never blocks
 * input the server would accept.
 */
export const INQUIRY_TYPES = [
  'general',
  'support',
  'copyright',
  'privacy',
  'partnership',
  'bug',
] as const;
export type InquiryType = (typeof INQUIRY_TYPES)[number];

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
export const cleanText = (s: string) => s.replace(CONTROL, '').trim();

export type ContactField = 'name' | 'email' | 'message';

/** Returns the set of invalid fields (empty when valid). Mirrors the length/format limits of the server schema. */
export function invalidContactFields(values: {
  name: string;
  email: string;
  message: string;
}): ContactField[] {
  const bad: ContactField[] = [];
  const name = cleanText(values.name);
  const email = cleanText(values.email);
  const message = cleanText(values.message);
  if (name.length < 2 || name.length > 100) bad.push('name');
  const emailOk =
    email.length <= 254 &&
    // Header-injection hard stop: no whitespace/newlines/commas/semicolons/angle brackets/quotes.
    !/[\s,;<>"]/.test(email) &&
    /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(email) &&
    !/\.\./.test(email);
  if (!emailOk) bad.push('email');
  if (message.length < 10 || message.length > 4000) bad.push('message');
  return bad;
}
