// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactForm } from '@/components/forms/contact-form';
import en from '../../messages/en.json';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const setup = () =>
  render(
    <NextIntlClientProvider locale="en" messages={en as never}>
      <ContactForm />
    </NextIntlClientProvider>,
  );

describe('ContactForm', () => {
  it('shows accessible per-field errors and does not submit invalid data', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('Enter your name (at least 2 characters).')).toBeInTheDocument();
    const email = screen.getByLabelText('Your email address');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByRole('alert')).toHaveTextContent('Please fix the highlighted fields.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('submits valid data, reports success and resets', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    setup();
    await user.type(screen.getByLabelText('Your name'), 'Ada Lovelace');
    await user.type(screen.getByLabelText('Your email address'), 'ada@example.com');
    await user.selectOptions(screen.getByLabelText('What is this about?'), 'copyright');
    await user.type(screen.getByLabelText('Message'), 'This is a long enough message.');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('Thank you. Your message has been sent.')).toBeInTheDocument();
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body).toMatchObject({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      type: 'copyright',
      website: '',
    });
    expect(screen.getByLabelText('Your name')).toHaveValue('');
  });

  it.each([
    ['SERVER_CONFIGURATION_ERROR', 'The contact form is not available right now'],
    ['RATE_LIMITED', 'You have sent several messages recently'],
    ['INTERNAL_ERROR', 'We could not send your message'],
  ])('shows a clear message for %s', async (code, text) => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: { code } }), { status: 503 }),
    );
    setup();
    await user.type(screen.getByLabelText('Your name'), 'Ada Lovelace');
    await user.type(screen.getByLabelText('Your email address'), 'ada@example.com');
    await user.type(screen.getByLabelText('Message'), 'This is a long enough message.');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(text));
  });

  it('keeps the honeypot out of the accessibility tree and tab order', () => {
    setup();
    const trap = document.querySelector('input[name="website"]') as HTMLInputElement;
    expect(trap).toHaveAttribute('tabindex', '-1');
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
