// push-dispatch (verify_jwt = false) — ARCHITECTURE §6.
// Called by the statement-level trigger notifications_dispatch (pg_net) with {notification_ids:[…]}
// and by cron bojo-push-sweep with {}. Auth: header x-bojo-dispatch-secret == PUSH_DISPATCH_SECRET.
// Flow: claim_push_batch → Expo push (chunks of 100) → complete_push_batch.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { json } from '../_shared/cors.ts';
import { renderPush, type NotificationType } from './templates.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_TOKENS_PER_USER = 5; // same cap as register_push_token / claim_push_batch
const MAX_MESSAGES_PER_RUN = 500; // claim_push_batch returns ≤100 notifications × ≤5 tokens
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ClaimRow {
  notification_id: string;
  user_id: string;
  type: NotificationType;
  payload: Record<string, unknown> | null;
  locale: string | null;
  tokens: string[] | null;
}
interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: { url: string; notification_id: string; type: NotificationType };
  sound: 'default';
  channelId: 'default';
}
interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const secret = Deno.env.get('PUSH_DISPATCH_SECRET') ?? '';
  const given = req.headers.get('x-bojo-dispatch-secret') ?? '';
  if (!secret || !given || !safeEqual(given, secret)) return json({ error: 'unauthorized' }, 401);

  let input: { notification_ids?: unknown } = {};
  try {
    input = (await req.json()) ?? {};
  } catch {
    input = {};
  }
  const ids = Array.isArray(input.notification_ids)
    ? input.notification_ids
        .filter((x): x is string => typeof x === 'string' && UUID_RE.test(x))
        .slice(0, 500)
    : [];

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const { data, error } = await supabase.rpc('claim_push_batch', {
    p_ids: ids.length ? ids : null,
    p_limit: 100,
  });
  if (error) {
    console.error('claim_push_batch failed', error.message);
    return json({ error: 'claim_failed' }, 500);
  }
  const rows = (data ?? []) as ClaimRow[];

  const messages: ExpoMessage[] = [];
  const owner: string[] = []; // notification id per message (same index)
  for (const r of rows) {
    const payload = r.payload ?? {};
    const text = renderPush(r.type, r.locale, payload);
    const url = typeof payload.url === 'string' ? payload.url : '/notifications';
    for (const to of (r.tokens ?? []).slice(0, MAX_TOKENS_PER_USER)) {
      if (messages.length >= MAX_MESSAGES_PER_RUN) break; // the rest is retried by the next sweep
      messages.push({
        to,
        title: text.title,
        body: text.body,
        data: { url, notification_id: r.notification_id, type: r.type },
        sound: 'default',
        channelId: 'default',
      });
      owner.push(r.notification_id);
    }
  }

  const okBy = new Map<string, boolean>();
  const errBy = new Map<string, string>();
  const invalidTokens = new Set<string>();
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');

  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(chunk),
      });
      const body = (await res.json().catch(() => null)) as {
        data?: ExpoTicket[];
        errors?: unknown;
      } | null;
      if (!res.ok || !Array.isArray(body?.data)) {
        const msg = `expo_http_${res.status}`;
        chunk.forEach((_, j) => {
          const n = owner[i + j]!;
          if (!okBy.get(n)) errBy.set(n, msg);
        });
        continue;
      }
      body.data.forEach((t, j) => {
        const n = owner[i + j]!;
        const m = chunk[j]!;
        if (t.status === 'ok') {
          okBy.set(n, true);
        } else {
          if (t.details?.error === 'DeviceNotRegistered') invalidTokens.add(m.to);
          if (!okBy.get(n)) errBy.set(n, t.details?.error ?? t.message ?? 'expo_error');
        }
      });
    } catch (e) {
      const msg = `expo_fetch_failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200);
      chunk.forEach((_, j) => {
        const n = owner[i + j]!;
        if (!okBy.get(n)) errBy.set(n, msg);
      });
    }
  }

  const results = rows.map((r) =>
    okBy.get(r.notification_id)
      ? { notification_id: r.notification_id, status: 'sent' }
      : {
          notification_id: r.notification_id,
          status: 'failed',
          error: errBy.get(r.notification_id) ?? 'no_ticket',
        },
  );
  if (results.length || invalidTokens.size) {
    const { error: cErr } = await supabase.rpc('complete_push_batch', {
      p_results: results,
      p_invalid_tokens: [...invalidTokens],
    });
    if (cErr) console.error('complete_push_batch failed', cErr.message);
  }

  const sent = results.filter((r) => r.status === 'sent').length;
  return json({
    claimed: rows.length,
    sent,
    failed: results.length - sent,
    invalid_tokens: invalidTokens.size,
  });
});
