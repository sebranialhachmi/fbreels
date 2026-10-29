import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/contact/route';
import { contactSchema } from '@/lib/contact';
import { MemoryRateLimiter, resetRateLimiterForTests } from '@/lib/rate-limit';

const valid = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  type: 'support',
  message: 'Hello, I need some help please.',
  website: '',
  startedAt: Date.now() - 10_000,
};

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost:3000/api/contact', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      host: 'localhost:3000',
      'x-forwarded-for': '198.51.100.30',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const resend = vi.fn();
beforeEach(() => {
  resetRateLimiterForTests(new MemoryRateLimiter());
  resend.mockReset().mockResolvedValue(new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', resend);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetRateLimiterForTests(undefined);
});

describe('contact schema', () => {
  it('rejects header-injection attempts in the email and trims/strips control characters', () => {
    expect(contactSchema.safeParse({ ...valid, email: 'a@b.com\nBcc: evil@x.com' }).success).toBe(
      false,
    );
    expect(contactSchema.safeParse({ ...valid, email: 'a@b.com, evil@x.com' }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, email: '"x"@b.com' }).success).toBe(false);
    const p = contactSchema.parse({ ...valid, name: '  Ada\u0000\u0007  ' });
    expect(p.name).toBe('Ada');
  });
  it('enforces length limits and inquiry types', () => {
    expect(contactSchema.safeParse({ ...valid, message: 'short' }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, message: 'x'.repeat(4001) }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, type: 'hack' }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, name: 'A' }).success).toBe(false);
  });
});

describe('POST /api/contact', () => {
  it('reports SERVER_CONFIGURATION_ERROR (and sends nothing) when delivery is not configured', async () => {
    const res = await POST(req(valid));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('SERVER_CONFIGURATION_ERROR');
    expect(resend).not.toHaveBeenCalled();
  });

  it('delivers via the email provider when configured, with the visitor only in Reply-To', async () => {
    vi.stubEnv('CONTACT_EMAIL', 'owner@example.org');
    vi.stubEnv('CONTACT_FROM_EMAIL', 'noreply@example.org');
    vi.stubEnv('CONTACT_PROVIDER_API_KEY', 'KEY');
    const res = await POST(req(valid));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    const [endpoint, init] = resend.mock.calls[0] as [string, RequestInit];
    expect(endpoint).toBe('https://api.resend.com/emails');
    const sent = JSON.parse(init.body as string);
    expect(sent.to).toEqual(['owner@example.org']);
    expect(sent.reply_to).toBe('ada@example.com');
    expect(sent.subject).not.toMatch(/[\r\n]/);
  });

  it('maps provider failure to PROVIDER_UNAVAILABLE', async () => {
    vi.stubEnv('CONTACT_EMAIL', 'owner@example.org');
    vi.stubEnv('CONTACT_FROM_EMAIL', 'noreply@example.org');
    vi.stubEnv('CONTACT_PROVIDER_API_KEY', 'KEY');
    resend.mockResolvedValue(new Response('no', { status: 500 }));
    const res = await POST(req(valid));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('PROVIDER_UNAVAILABLE');
  });

  it('silently drops honeypot and too-fast submissions (no delivery, bots learn nothing)', async () => {
    vi.stubEnv('CONTACT_EMAIL', 'owner@example.org');
    vi.stubEnv('CONTACT_FROM_EMAIL', 'noreply@example.org');
    vi.stubEnv('CONTACT_PROVIDER_API_KEY', 'KEY');
    const bot = await POST(req({ ...valid, website: 'http://spam.example' }));
    expect(await bot.json()).toEqual({ success: true });
    const fast = await POST(req({ ...valid, startedAt: Date.now() }));
    expect(await fast.json()).toEqual({ success: true });
    expect(resend).not.toHaveBeenCalled();
  });

  it('returns field-level validation errors (422) for bad input and rejects cross-origin posts', async () => {
    const bad = await POST(req({ ...valid, email: 'nope', message: 'x' }));
    expect(bad.status).toBe(422);
    const body = await bad.json();
    expect(body.error.fields).toEqual(expect.arrayContaining(['email', 'message']));
    const cross = await POST(req(valid, { origin: 'https://evil.example' }));
    expect(cross.status).toBe(403);
  });

  it('rate-limits repeat submissions', async () => {
    let status = 0;
    for (let i = 0; i < 7; i++) status = (await POST(req({ ...valid, website: 'bot' }))).status;
    expect(status).toBe(429);
  });
});
