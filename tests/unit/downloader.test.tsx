// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Downloader } from '@/components/downloader/downloader';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';
import ar from '../../messages/ar.json';

const messages = { en, fr, ar } as const;
const VALID = 'https://www.facebook.com/reel/1234567890';

function renderDownloader(locale: keyof typeof messages = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale] as never}>
      <Downloader />
    </NextIntlClientProvider>,
  );
}

const media = (over = {}) => ({
  success: true,
  media: {
    title: 'A title',
    thumbnail: null,
    duration: 75,
    source: 'http-json',
    formats: [
      {
        id: 'hd',
        type: 'video',
        quality: 'HD',
        mimeType: 'video/mp4',
        size: 5 * 1024 * 1024,
        downloadToken: 'tok-hd',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      },
      {
        id: 'sd',
        type: 'video',
        quality: 'SD',
        mimeType: null,
        size: null,
        downloadToken: 'tok-sd',
        expiresAt: null,
      },
    ],
    ...over,
  },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Downloader — idle and validation', () => {
  it('renders a labelled input and the main Download button', () => {
    renderDownloader();
    expect(screen.getByLabelText('Facebook Reel or video link')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Paste from clipboard' })).toBeInTheDocument();
  });

  it('does not send anything while typing or pasting, only on submit', async () => {
    const user = userEvent.setup();
    renderDownloader();
    await user.type(screen.getByLabelText('Facebook Reel or video link'), VALID);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['', 'Paste a Facebook Reel or video link first.'],
    ['not a link', 'That does not look like a valid link'],
    ['https://example.com/video/1234567', 'This link is not supported'],
    ['https://facebook.com.evil.com/reel/1234567890', 'This link is not supported'],
  ])('shows an accessible message for %j without calling the server', async (value, message) => {
    const user = userEvent.setup();
    renderDownloader();
    const input = screen.getByLabelText('Facebook Reel or video link');
    if (value) await user.type(input, value);
    await user.click(screen.getByRole('button', { name: 'Download' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain(screen.getByRole('alert').id);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Downloader — clipboard', () => {
  it('pastes into the field without auto-submitting', async () => {
    const user = userEvent.setup();
    renderDownloader();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText: vi.fn().mockResolvedValue(VALID) },
    });
    await user.click(screen.getByRole('button', { name: 'Paste from clipboard' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Facebook Reel or video link')).toHaveValue(VALID),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('degrades gracefully when clipboard access is denied or unsupported', async () => {
    const user = userEvent.setup();
    renderDownloader();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')) },
    });
    await user.click(screen.getByRole('button', { name: 'Paste from clipboard' }));
    expect(await screen.findByText(/could not read your clipboard/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Facebook Reel or video link')).toHaveValue('');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    await user.click(screen.getByRole('button', { name: 'Paste from clipboard' }));
    expect(await screen.findByText(/could not read your clipboard/i)).toBeInTheDocument();
  });

  it('clears the input and returns focus to it', async () => {
    const user = userEvent.setup();
    renderDownloader();
    const input = screen.getByLabelText('Facebook Reel or video link');
    await user.type(input, VALID);
    await user.click(screen.getByRole('button', { name: 'Clear the link' }));
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });
});

describe('Downloader — request lifecycle', () => {
  it('shows loading, blocks duplicate submits, then renders only verified results', async () => {
    const user = userEvent.setup();
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    renderDownloader();
    await user.type(screen.getByLabelText('Facebook Reel or video link'), VALID);
    await user.click(screen.getByRole('button', { name: 'Download' }));

    expect(await screen.findByTestId('loading-skeleton')).toBeInTheDocument();
    const busy = screen.getByRole('button', { name: /Checking/ });
    expect(busy).toBeDisabled();
    await user.keyboard('{Enter}'); // keyboard submit while busy must not double-send
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('result-card')).not.toBeInTheDocument(); // no success before the server confirms

    resolve(json(media()));
    const card = await screen.findByTestId('result-card');
    expect(within(card).getByText('A title')).toBeInTheDocument();
    expect(within(card).getByText('1:15')).toBeInTheDocument();
    const links = within(card).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/api/download?t=tok-hd');
    expect(links[0]).toHaveAttribute('download');
    expect(within(card).getByText(/5 MB|5,0 MB|5.0 MB/)).toBeInTheDocument();
    expect(within(card).getByText('Size not provided')).toBeInTheDocument(); // unknown size is not invented
    expect(within(card).getByText(/stop working around/)).toBeInTheDocument();
    expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ url: VALID });
  });

  it('labels mock data as test data', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(json(media({ source: 'mock' })));
    renderDownloader();
    await user.type(screen.getByLabelText('Facebook Reel or video link'), VALID);
    await user.click(screen.getByRole('button', { name: 'Download' }));
    expect(await screen.findByText('Test data')).toBeInTheDocument();
  });

  it('omits HD/audio entries that the server did not report', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      json(
        media({
          formats: [
            {
              id: 'sd',
              type: 'video',
              quality: 'SD',
              mimeType: 'video/mp4',
              size: null,
              downloadToken: 't',
              expiresAt: null,
            },
          ],
        }),
      ),
    );
    renderDownloader();
    await user.type(screen.getByLabelText('Facebook Reel or video link'), VALID);
    await user.click(screen.getByRole('button', { name: 'Download' }));
    const card = await screen.findByTestId('result-card');
    expect(within(card).queryByText(/HD/)).not.toBeInTheDocument();
    expect(within(card).queryByText(/Audio/)).not.toBeInTheDocument();
  });

  it.each([
    ['PRIVATE_OR_INACCESSIBLE_CONTENT', /private or not publicly accessible/],
    ['CONTENT_UNAVAILABLE', /unavailable/],
    ['NO_SUPPORTED_FORMATS', /no downloadable format/],
    ['PROVIDER_UNAVAILABLE', /temporarily unavailable/],
    ['SERVER_CONFIGURATION_ERROR', /has not been configured/],
    ['REQUEST_TIMEOUT', /took too long/],
    ['TOKEN_EXPIRED', /has expired/],
    ['INTERNAL_ERROR', /Something went wrong/],
    ['SOMETHING_NEW', /Something went wrong/],
  ])('renders %s with a retry action', async (code, text) => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(json({ success: false, error: { code } }, 400));
    renderDownloader();
    await user.type(screen.getByLabelText('Facebook Reel or video link'), VALID);
    await user.click(screen.getByRole('button', { name: 'Download' }));
    const panel = await screen.findByTestId('error-panel');
    expect(panel).toHaveTextContent(text);
    expect(screen.queryByTestId('result-card')).not.toBeInTheDocument();
    fetchMock.mockResolvedValue(json(media()));
    await user.click(within(panel).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('result-card')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows the retry delay for rate limiting and handles network failure', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      json({ success: false, error: { code: 'RATE_LIMITED', retryAfterSeconds: 42 } }, 429),
    );
    renderDownloader();
    await user.type(screen.getByLabelText('Facebook Reel or video link'), VALID);
    await user.click(screen.getByRole('button', { name: 'Download' }));
    expect(await screen.findByTestId('error-panel')).toHaveTextContent('42 seconds');
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(screen.getByTestId('error-panel')).toHaveTextContent(/could not reach the server/),
    );
  });

  it('treats a 200 with no formats or a malformed body as an error, never as success', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(json(media({ formats: [] })));
    renderDownloader();
    await user.type(screen.getByLabelText('Facebook Reel or video link'), VALID);
    await user.click(screen.getByRole('button', { name: 'Download' }));
    expect(await screen.findByTestId('error-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('result-card')).not.toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 200 }));
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByTestId('error-panel')).toBeInTheDocument());
  });

  it('turns an expired result into the expired-link state instead of a dead download', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      json(
        media({
          formats: [
            {
              id: 'hd',
              type: 'video',
              quality: 'HD',
              mimeType: 'video/mp4',
              size: null,
              downloadToken: 't',
              expiresAt: new Date(Date.now() - 1000).toISOString(),
            },
          ],
        }),
      ),
    );
    renderDownloader();
    await user.type(screen.getByLabelText('Facebook Reel or video link'), VALID);
    await user.click(screen.getByRole('button', { name: 'Download' }));
    await user.click(await screen.findByRole('link', { name: /Save/ }));
    expect(await screen.findByTestId('error-panel')).toHaveTextContent('has expired');
  });
});

describe('Downloader — localized UI', () => {
  it.each([
    ['fr', 'Télécharger', 'Lien du Reel ou de la vidéo Facebook'],
    ['ar', 'تحميل', 'رابط ريلز أو فيديو فيسبوك'],
  ] as const)('renders %s labels and localized errors', async (locale, submit, label) => {
    const user = userEvent.setup();
    renderDownloader(locale);
    expect(screen.getByLabelText(label)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: submit }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      (messages[locale].downloader.errors as Record<string, string>).EMPTY!,
    );
    expect(screen.getByLabelText(label)).toHaveAttribute('dir', 'ltr'); // URLs stay LTR even in Arabic
  });
});
