/** Default attachment size when MAX_UPLOAD_BYTES is not configured (10 MiB). */
const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Resolve the configured maximum attachment size to a safe positive byte count.
 * Cloudflare environment bindings are commonly strings, but numeric values are
 * accepted as well. Invalid or missing values use the documented default.
 */
export function maxUploadBytes(configured: unknown): number {
  const parsed = typeof configured === 'number'
    ? configured
    : typeof configured === 'string' && configured.trim() !== ''
      ? Number(configured.trim())
      : Number.NaN;

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return DEFAULT_MAX_UPLOAD_BYTES;
  }

  return parsed;
}
