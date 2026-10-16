// In-app route check shared by the inbox and push taps (security review L5). A notification `url` must be
// an app-internal path like "/event/<id>": protocol-relative ("//host", "/\host"), absolute ("https://…",
// "javascript:…"), backslashes, whitespace and control characters are rejected.
const MAX_URL_LENGTH = 512;
const BACKSLASH = String.fromCharCode(92);

export function isSafeInternalUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length === 0 || url.length > MAX_URL_LENGTH) return false;
  if (!url.startsWith('/') || url.startsWith('//')) return false;
  if (url.includes('://') || url.includes(BACKSLASH)) return false;
  return !/[\s\u0000-\u001f\u007f]/.test(url);
}
