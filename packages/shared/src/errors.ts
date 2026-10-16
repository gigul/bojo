// Closed list of RPC error codes (ARCHITECTURE §5.0). Raised as `raise exception '<code>'`;
// the client reads `error.message` and maps it to the i18n key `errors:<code>`.

export const RPC_ERROR_CODES = [
  'not_authenticated',
  'not_found',
  'forbidden',
  'invalid_input',
  'rate_limited',
  'profile_incomplete',
  'event_full',
  'event_not_joinable',
  'organizer_cannot_leave',
  'not_participant',
  'attendance_window_closed',
  'outside_service_area',
  'duplicate_venue',
  'match_inactive',
] as const;
export type RpcErrorCode = (typeof RPC_ERROR_CODES)[number];

export function isRpcErrorCode(x: unknown): x is RpcErrorCode {
  return typeof x === 'string' && (RPC_ERROR_CODES as readonly string[]).includes(x);
}
