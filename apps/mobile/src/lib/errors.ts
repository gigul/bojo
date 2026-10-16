import { isRpcErrorCode, type RpcErrorCode } from '@bojo/shared';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export type AppErrorCode = RpcErrorCode | 'network' | 'unknown';

interface ErrorLike {
  message?: unknown;
  name?: unknown;
  status?: unknown;
  code?: unknown;
  details?: unknown;
}

function asErrorLike(e: unknown): ErrorLike | null {
  return typeof e === 'object' && e !== null ? (e as ErrorLike) : null;
}

const NETWORK_MESSAGE =
  /network request failed|failed to fetch|networkerror|load failed|fetch failed|timed? ?out|aborted/i;
const NETWORK_ERROR_NAMES = new Set([
  'AuthRetryableFetchError',
  'FunctionsFetchError',
  'StorageUnknownError',
  'TypeError',
]);

/** True for transport-level failures (offline, DNS, CORS, timeouts). */
export function isNetworkError(e: unknown): boolean {
  const err = asErrorLike(e);
  if (!err) return false;
  const message = typeof err.message === 'string' ? err.message : '';
  if (NETWORK_MESSAGE.test(message)) return true;
  return typeof err.name === 'string' && NETWORK_ERROR_NAMES.has(err.name) && err.status === 0;
}

/**
 * Maps any error (PostgrestError from an RPC `raise exception '<code>'`, AuthError, fetch failure…)
 * onto the closed list of codes (§5.0) + 'network' | 'unknown'. Use with the i18n key `errors:<code>`.
 */
export function getRpcErrorCode(e: unknown): AppErrorCode {
  const err = asErrorLike(e);
  if (!err) return 'unknown';
  const message = typeof err.message === 'string' ? err.message.trim() : '';
  if (isRpcErrorCode(message)) return message;
  if (isNetworkError(e)) return 'network';
  // Auth API: 429 / over_*_rate_limit
  if (err.status === 429 || (typeof err.code === 'string' && err.code.includes('rate_limit'))) {
    return 'rate_limited';
  }
  // PostgREST: RLS / privilege failures
  if (err.code === '42501' || err.status === 403) return 'forbidden';
  if (err.code === 'PGRST116') return 'not_found';
  return 'unknown';
}

/** `isRpcError(e, 'event_full')` */
export function isRpcError(e: unknown, code: AppErrorCode): boolean {
  return getRpcErrorCode(e) === code;
}

/** PostgREST `details` (e.g. the existing venue id for `duplicate_venue`). */
export function getErrorDetails(e: unknown): string | null {
  const details = asErrorLike(e)?.details;
  return typeof details === 'string' && details.length > 0 ? details : null;
}

/** Retry policy for React Query: only transport/unknown failures are worth retrying. */
export function isRetryableError(e: unknown): boolean {
  const code = getRpcErrorCode(e);
  return code === 'network' || code === 'unknown';
}

/** Localised, user-facing text for any error. */
export function useErrorText(): (e: unknown) => string {
  const { t } = useTranslation('errors');
  return useCallback((e: unknown) => t(getRpcErrorCode(e)), [t]);
}
