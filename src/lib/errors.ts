export const ERROR_CODES = [
  'INVALID_URL',
  'UNSUPPORTED_URL',
  'CONTENT_UNAVAILABLE',
  'PRIVATE_OR_INACCESSIBLE_CONTENT',
  'NO_SUPPORTED_FORMATS',
  'PROVIDER_UNAVAILABLE',
  'RATE_LIMITED',
  'REQUEST_TIMEOUT',
  'TOKEN_EXPIRED',
  'SERVER_CONFIGURATION_ERROR',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const HTTP_STATUS: Record<ErrorCode, number> = {
  INVALID_URL: 400,
  UNSUPPORTED_URL: 422,
  CONTENT_UNAVAILABLE: 404,
  PRIVATE_OR_INACCESSIBLE_CONTENT: 403,
  NO_SUPPORTED_FORMATS: 422,
  PROVIDER_UNAVAILABLE: 503,
  RATE_LIMITED: 429,
  REQUEST_TIMEOUT: 504,
  TOKEN_EXPIRED: 410,
  SERVER_CONFIGURATION_ERROR: 503,
  INTERNAL_ERROR: 500,
};

/** Application error carrying only a safe, machine-readable code. */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly retryAfterSeconds?: number,
  ) {
    super(code);
    this.name = 'AppError';
  }
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}
