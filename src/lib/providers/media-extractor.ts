import type { ProviderMedia } from '@/types/media';

export interface MediaExtractor {
  /** Stable identifier reported as `media.source`. */
  readonly id: string;
  /** If true, short/share links are expanded (SSRF-guarded) before `resolve` is called. */
  readonly requiresExpandedUrl: boolean;
  /**
   * Resolve a validated, normalized Facebook URL. Must throw AppError with a safe code on failure.
   * Must return only verified values: no invented formats, sizes or URLs.
   */
  resolve(input: { url: string; signal?: AbortSignal }): Promise<ProviderMedia>;
}
