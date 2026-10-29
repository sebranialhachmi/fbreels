import { z } from 'zod';

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

const clean = (s: string) => s.replace(CONTROL, '').trim();

export const contactSchema = z.object({
  name: z.string().transform(clean).pipe(z.string().min(2).max(100)),
  email: z
    .string()
    .transform(clean)
    .pipe(z.string().max(254).email())
    // Header-injection hard stop: no whitespace/newlines/commas/angle brackets.
    .refine((v) => !/[\s,;<>"]/.test(v)),
  type: z.enum(INQUIRY_TYPES),
  message: z.string().transform(clean).pipe(z.string().min(10).max(4000)),
  /** Honeypot: real users never see or fill this. */
  website: z.string().max(500).optional().default(''),
  /** ms timestamp captured when the form was rendered (anti-bot minimum fill time). */
  startedAt: z.number().int().optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;

export const MIN_FILL_MS = 2500;

export type ContactConfig = {
  to: string;
  from: string;
  apiKey: string;
};

export function getContactConfig(env: NodeJS.ProcessEnv = process.env): ContactConfig | null {
  const to = env.CONTACT_EMAIL?.trim();
  const from = env.CONTACT_FROM_EMAIL?.trim();
  const apiKey = env.CONTACT_PROVIDER_API_KEY?.trim();
  if (!to || !from || !apiKey) return null;
  return { to, from, apiKey };
}

/** Delivers via the Resend REST API. Untested against the live service in this repository. */
export async function deliverContactMessage(
  cfg: ContactConfig,
  input: Pick<ContactInput, 'name' | 'email' | 'type' | 'message'>,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: cfg.from,
      to: [cfg.to],
      reply_to: input.email,
      subject: `[contact:${input.type}] message from ${input.name.slice(0, 60)}`.replace(
        /[\r\n]/g,
        ' ',
      ),
      text: `Name: ${input.name}\nEmail: ${input.email}\nType: ${input.type}\n\n${input.message}`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  return res.ok;
}
