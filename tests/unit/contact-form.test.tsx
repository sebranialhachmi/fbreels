// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactForm } from '@/components/forms/contact-form';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('الاسم'), 'أحمد علي');
  await user.type(screen.getByLabelText('البريد الإلكتروني'), 'a@example.com');
  await user.type(screen.getByLabelText('الرسالة'), 'هذه رسالة اختبار طويلة بما يكفي.');
}

describe('ContactForm', () => {
  it('shows accessible per-field errors and does not submit invalid data', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);
    await user.click(screen.getByRole('button', { name: 'إرسال الرسالة' }));
    expect(await screen.findByText('أدخل اسمك (حرفان على الأقل).')).toBeInTheDocument();
    const email = screen.getByLabelText('البريد الإلكتروني');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByRole('alert')).toHaveTextContent('يرجى تصحيح الحقول المحدّدة.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('submits valid data, reports success and resets', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    render(<ContactForm />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'إرسال الرسالة' }));
    expect(await screen.findByText('شكراً لك. تم إرسال رسالتك.')).toBeInTheDocument();
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body).toMatchObject({
      name: 'أحمد علي',
      email: 'a@example.com',
      type: 'general',
      website: '',
    });
    expect(screen.getByLabelText('الاسم')).toHaveValue('');
  });

  it.each([
    ['SERVER_CONFIGURATION_ERROR', 'نموذج الاتصال غير متاح حالياً'],
    ['RATE_LIMITED', 'أرسلت عدة رسائل مؤخراً'],
    ['INTERNAL_ERROR', 'تعذّر إرسال رسالتك'],
  ])('shows a clear message for %s', async (code, text) => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: { code } }), { status: 503 }),
    );
    render(<ContactForm />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'إرسال الرسالة' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(text));
  });

  it('keeps the honeypot out of the accessibility tree and tab order', () => {
    render(<ContactForm />);
    const trap = document.querySelector('input[name="website"]') as HTMLInputElement;
    expect(trap).toHaveAttribute('tabindex', '-1');
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
