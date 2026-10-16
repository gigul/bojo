# Bojo — Supabase backend (local)

Postgres 17 + PostGIS, Auth (email OTP), Realtime, Storage, pg_cron + pg_net, two Edge Functions.
The binding contract is `ARCHITECTURE.md` (§3–§8); this folder implements it.

All commands run from the repo root. Until the root `npm install` provides the `supabase` binary, prefix with
`npx -y supabase@2.121.0` (the root scripts `npm run db:*` do the same with the local binary).

## Start / stop / reset

```sh
npx -y supabase@2.121.0 start      # first run pulls Docker images (several minutes)
npx -y supabase@2.121.0 db reset   # drop + re-apply migrations/ and seeds/ (≈30 s)
npx -y supabase@2.121.0 stop
npx -y supabase@2.121.0 status     # URLs + keys (keys only ever go into gitignored .env files)
```

`supabase status` shape (ports from `config.toml`, project_id `bojo`):

| Name | Value |
|---|---|
| API / REST / GraphQL | `http://127.0.0.1:44321` · `/rest/v1` · `/graphql/v1` |
| Edge Functions | `http://127.0.0.1:44321/functions/v1/<name>` |
| DB | `postgresql://postgres:postgres@127.0.0.1:44322/postgres` |
| Studio | `http://127.0.0.1:44323` |
| Mailpit (OTP emails) | `http://127.0.0.1:44324` |
| Keys | `ANON_KEY` / `PUBLISHABLE_KEY` (client), `SERVICE_ROLE_KEY` / `SECRET_KEY` (server only — never in the app) |

The app needs `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `apps/mobile/.env`
(on a phone use your PC's LAN IP instead of 127.0.0.1; Android emulator: `http://10.0.2.2:44321`).

## Layout

| Path | What |
|---|---|
| `migrations/20261015000001…21_*.sql` | extensions → enums → tables → helpers/triggers → RPCs → RLS → **grants (revoke-all + explicit grants)** → storage → realtime → cron → card previews (18) → chat polish (19) → storage policy fix + venue flags (20) → privacy hardening (21); later migrations re-grant what they recreate |
| `seeds/00_local_vault.sql` | dev placeholder vault secrets for pg_net → `push-dispatch` (not real keys) |
| `seeds/10_districts_osm.sql`, `seeds/20_venues_osm.sql` | **generated** by `scripts/osm` from OpenStreetMap (ODbL) — don't edit |
| `seeds/90_dev_mock.sql` | 12 `[DEV]` users, ~20 events at real OSM venues, 1 weekly series, 1 match + chat (local only) |
| `tests/*.test.sql` | pgTAP: privileges, RLS, location privacy, events/joining, matching, venues, push outbox, cron |
| `functions/push-dispatch` | outbox → Expo push (secret header auth, `verify_jwt = false`) |
| `functions/delete-account` | deletes the caller (JWT) incl. avatar files |
| `templates/otp.html` | ru/pl/en email with the 6-digit `{{ .Token }}` |

## Signing in locally (OTP)

1. In the app (or via `supabase.auth.signInWithOtp({ email })`) request a code.
2. Open Mailpit at **http://127.0.0.1:44324** — the email shows the 6-digit code.
3. `verifyOtp({ email, token, type: 'email' })`.

Dev users: `dev01@bojo.test` … `dev12@bojo.test` (ids `d0000000-0000-4000-8000-0000000000NN`), all onboarded,
with sports/levels/availability/districts. `dev01` (Anna) is also a moderator and has a match + chat with
`dev02` (Piotr). Codes for these addresses also land in Mailpit. `max_frequency = 30s` between code requests.

Remove dev data: `delete from auth.users where email like '%@bojo.test';` (cascades) and
`delete from public.events where is_mock; delete from public.event_series where is_mock;`.

## Auth & privacy rules (migration 21)

- Sign-in is **email code only**: `enable_confirmations = true`, and the custom access-token hook
  `private.auth_token_hook` (config `[auth.hook.custom_access_token]`) refuses `password` grants with 403.
  (GoTrue gives OTP users a random bcrypt password too, so sign-ups can't be filtered at INSERT time.)
  Changing `config.toml` auth settings needs `supabase stop && supabase start` (data is kept).
- Cross-user distance = distance between ~2 km cells (0.02° × 0.03°) of both homes, bucketed 3/5/10/15/25 km;
  `score_distance = exp(-bucket/5)`. The stored home stays snapped to ~550 m (server-side nearby notifications).
- `set_home_location`: the first change after onboarding is free, then one change per 7 days.
- `person_summary` shows distance/common slots only with an active match or (target discoverable and caller
  onboarded); common slots are capped at 3 unless matched.

## Tests

```sh
npx -y supabase@2.121.0 test db      # pgTAP (supabase/tests/*.test.sql)
npx -y supabase@2.121.0 db lint --schema public,private --level warning
```

## Types

```sh
npx -y supabase@2.121.0 gen types typescript --local --schema public > packages/shared/src/database.types.ts
npx -y prettier@3 --parser typescript --print-width 120 --single-quote --write packages/shared/src/database.types.ts
```
(`npm run db:types` does the first step.) `packages/shared/src/rpc.types.ts` stays hand-written, and
`packages/shared/src/database.ts` (not generated) narrows `jsonb` RPC outputs such as `participants_preview`;
`@bojo/shared` exports that `Database`.

## OSM import

`npm run osm:import` (or `node scripts/osm/src/main.ts`) regenerates `seeds/10_districts_osm.sql` and
`seeds/20_venues_osm.sql`; see `scripts/osm/README.md`. Then `db reset`.

## Edge Functions + push locally

`supabase start` serves `functions/*` and loads `supabase/functions/.env` automatically:

```sh
cp supabase/functions/.env.example supabase/functions/.env   # PUSH_DISPATCH_SECRET=local-dev-dispatch-secret
npx -y supabase@2.121.0 stop && npx -y supabase@2.121.0 start  # or: npm run functions:serve
```

Flow: `insert into notifications` → statement trigger → `pg_net` POST `http://host.docker.internal:44321/functions/v1/push-dispatch`
(URL + secret from Vault, seeded by `00_local_vault.sql`) → `claim_push_batch` → Expo push API → `complete_push_batch`.
Cron `bojo-push-sweep` retries every minute. Without the secret/env the dispatch is a no-op and the in-app inbox
(Realtime on `notifications`) still works. Device push can only be verified on a real device with an EAS project id.

Production: set real Vault secrets once in the SQL editor —
`select vault.create_secret('https://<ref>.supabase.co/functions/v1','bojo_functions_url');`
`select vault.create_secret('<random>','bojo_dispatch_secret');` — and the same value as the
`PUSH_DISPATCH_SECRET` function secret. Production email needs custom SMTP.

## Cron jobs (UTC)

`bojo-complete-events` (`5 * * * *`), `bojo-materialize-series` (`0 2 * * *`), `bojo-nearby-events` (`*/15 * * * *`),
`bojo-push-sweep` (`* * * * *`), `bojo-cleanup` (`30 3 * * *`). Inspect with `select * from cron.job;`.
