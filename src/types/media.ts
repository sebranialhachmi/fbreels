import { z } from 'zod';

export const mediaTypeSchema = z.enum(['video', 'audio']);

/** A downloadable variant. Only verified values; `downloadToken` is opaque to the client. */
export const mediaFormatSchema = z.object({
  id: z.string().min(1).max(64),
  type: mediaTypeSchema,
  /** e.g. "HD", "SD", "720p" – exactly what the provider reported. */
  quality: z.string().min(1).max(32),
  mimeType: z.string().max(100).nullable(),
  /** Bytes, only when known. */
  size: z.number().int().positive().nullable(),
  downloadToken: z.string().min(1).max(8192),
  /** ISO 8601, when the download reference stops working. */
  expiresAt: z.string().datetime().nullable(),
});

export const resolvedMediaSchema = z.object({
  title: z.string().max(300).nullable(),
  thumbnail: z.string().url().max(2048).nullable(),
  /** Seconds, only when verified. */
  duration: z.number().nonnegative().nullable(),
  /** Provider identifier (e.g. "mock", "http-json"). */
  source: z.string().max(64),
  formats: z.array(mediaFormatSchema),
});

export type MediaFormat = z.infer<typeof mediaFormatSchema>;
export type ResolvedMediaPublic = z.infer<typeof resolvedMediaSchema>;

/** What an extractor returns internally: formats still carry the upstream URL. */
export type ProviderFormat = {
  id: string;
  type: 'video' | 'audio';
  quality: string;
  mimeType: string | null;
  size: number | null;
  /** Upstream media URL (https), or "mock:<id>" for the test-only provider. Never sent to clients. */
  upstreamUrl: string;
  expiresAt: Date | null;
};

export type ProviderMedia = {
  title: string | null;
  thumbnail: string | null;
  duration: number | null;
  source: string;
  formats: ProviderFormat[];
};

export const extractRequestSchema = z.object({ url: z.string().min(1).max(4096) }).strict();

export const extractSuccessSchema = z.object({
  success: z.literal(true),
  media: resolvedMediaSchema,
});

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    retryAfterSeconds: z.number().int().positive().optional(),
  }),
});

export type ExtractResponse =
  z.infer<typeof extractSuccessSchema> | z.infer<typeof errorResponseSchema>;
