import { describe, expect, it } from 'vitest';
import { contentDisposition, extensionForMime, safeFilename } from '@/lib/security/filename';

describe('safeFilename', () => {
  it('builds a plain ASCII name with the right extension', () => {
    expect(safeFilename('My cool video', 'HD', 'video/mp4')).toBe('My_cool_video-HD.mp4');
    expect(safeFilename(null, 'SD', 'video/mp4', 'ReelSave')).toBe('ReelSave-SD.mp4');
    expect(safeFilename('Song', 'Audio', 'audio/mpeg')).toBe('Song-Audio.mp3');
  });

  it('neutralises path traversal, separators, quotes and header-breaking characters', () => {
    const nasty = '../../etc/passwd"\r\nSet-Cookie: x=1; \\ /:*?<>|%00';
    const name = safeFilename(nasty, 'HD', 'video/mp4');
    expect(name).not.toMatch(/[\\/:*?"<>|%;\r\n]/);
    expect(name).not.toContain('..');
    expect(name.endsWith('.mp4')).toBe(true);
    expect(name.length).toBeLessThanOrEqual(80);
  });

  it('drops non-ASCII titles safely and falls back to the brand', () => {
    expect(safeFilename('مرحبا بالعالم', 'HD', 'video/mp4', 'ReelSave')).toBe('ReelSave-HD.mp4');
  });

  it('truncates very long titles and never starts with a dot', () => {
    expect(safeFilename('a'.repeat(500), 'HD', 'video/mp4').length).toBeLessThan(80);
    expect(safeFilename('...hidden', 'HD', 'video/mp4').startsWith('.')).toBe(false);
  });

  it('unknown MIME types never produce an executable-looking extension', () => {
    expect(extensionForMime('application/x-msdownload')).toBeNull();
    expect(safeFilename('x', 'HD', 'application/x-msdownload')).toBe('x-HD.bin');
  });
});

describe('contentDisposition', () => {
  it('is always an attachment with an ASCII fallback and RFC 5987 name, no injection', () => {
    const v = contentDisposition('na"me\r\n.mp4');
    expect(v.startsWith('attachment; filename="')).toBe(true);
    expect(v).not.toMatch(/[\r\n]/);
    expect(v).toContain("filename*=UTF-8''");
    expect(v.split('filename="')[1]!.split('"')[0]).toMatch(/^[A-Za-z0-9._-]+$/);
  });
});
