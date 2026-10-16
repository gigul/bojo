# Bojo — MVP Architecture (ARCHITECTURE.md)

## Кратко: ключевые решения

| Вопрос | Решение | Почему |
|---|---|---|
| Платформы | Expo SDK 57 + Expo Router, одна кодовая база iOS / Android / web (SPA) | одна команда, Expo Go для разработки |
| Карты | `react-native-maps` на iOS/Android + `maplibre-gl` на вебе (OpenFreeMap) за единым `<VenueMap>` | MapLibre RN не работает в Expo Go; react-native-maps не работает на вебе; OpenFreeMap — без ключей и биллинга |
| Бэкенд | Supabase: Postgres 17 + PostGIS, Auth (email-код), Realtime, Storage, 2 Edge Functions | транзакционная логика — в RPC (Postgres), Edge Functions — только для HTTP к Expo Push и удаления аккаунта |
| Геоприватность | дом пользователя хранится только в owner-only таблице, округлён до сетки ~550 м; другим — только «~N км» и район | см. §8 |
| Повторяющиеся события | `event_series` + материализация конкретных событий на 14 дней вперёд | у каждого вхождения свои участники, чат и места |
| Push | outbox-таблица `notifications` → pg_net → `push-dispatch` → Expo Push | in-app инбокс работает даже без push (Expo Go Android, web) |
| Монорепо | npm workspaces: `apps/mobile`, `packages/shared`, `scripts/osm`, `supabase/` | на машине только npm; Expo ≥52 сам настраивает Metro |
| i18n | ru (по умолчанию), pl, en; неймспейсы по владельцам | параллельная разработка без конфликтов |
| Площадки | только OSM (импорт скриптом, ODbL-атрибуция) + пользовательские добавления/правки через модерацию | требование «не выдумывать данные» |

## §0 Integrator amendments (override the sections below where they conflict)

These were decided by the lead after reviewing the plan. **Where §0 and a later section disagree, §0 wins.**

- **A1 — Visual system = `docs/DESIGN.md`.** Ignore the "Suggested palette" in §2.6 (green/orange + per-sport colours). One accent only: lime `#C8F031`. `Theme.colors` is exactly:
  `background, surface, surfaceAlt, border, text, textMuted, textInverse, primary, primaryPressed, onPrimary, primaryText, success, warning, danger, overlay, skeleton, mapMarker, mapMarkerSelected` — **no `accent` key and no `sport` colour map**. `primary` = lime fill (same in both themes), `onPrimary` = `#121411`, `primaryText` = accent used as text/icon colour with ≥4.5:1 contrast (`#3E6A00` light / `#C8F031` dark). Lime is never used as text on light backgrounds. Sport identity comes from the pictogram, not colour. `radius = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 }`; spacing as in §2.6. Font: **Manrope** (`@expo-google-fonts/manrope`, weights 500/600/700/800), system font until loaded; type scale from DESIGN.md mapped onto the `typography` keys in §2.6.
- **A2 — Own sport pictograms.** `SportIcon {sportId, size?, color?, active?}` renders a **custom SVG set** (`react-native-svg`) drawn on a 24×24 grid, 1.75 stroke, round caps/joins, no fills except `active`. One glyph per sport in §9.3 plus a generic `multi`. UI icons (`Icon`) use **Feather** from `@expo/vector-icons` (stroke style matches). `sports.icon` column / `SportDef.icon` hold the pictogram key, which equals the sport id. MaterialCommunityIcons are not used for sports.
- **A3 — Extra dependencies** (b1 installs): `react-native-svg`, `@expo-google-fonts/manrope`. No other UI libraries.
- **A4 — OSM import follows `docs/OSM_IMPORT.md`** (queries per category, normalization, exclusions, grouping, licensing) where it is more detailed than §10. Sport mapping onto the 9 sports in §9.3: `beachvolleyball`→volleyball; `sport=multi` → football + basketball + volleyball with `inferred=true`; padel / table_tennis / swimming / workout / running as in the doc. The product owner approved running the live Overpass import (≈7 sequential Warsaw-only queries). User-Agent `bojo-osm-import/0.1 (dev)`; `OVERPASS_CONTACT` is optional and **empty by default — never put a personal email in it automatically**.
- **A5 — Verification is honest.** If something can't be verified locally (device push, Expo Go on a physical device), say so in the report rather than claiming it works.

**Findings of the Expo SDK 57 spike** (`.research/expo-spike`, gitignored; web/iOS/Android bundles, tsc, lint and expo-doctor all passed there):
- **A6 — Routes live in `apps/mobile/src/app/`** (the SDK 57 default template layout), not `apps/mobile/app/`. Every route path in §2.1/§2.2/§2.3/§11 maps 1:1: `app/X` → `src/app/X`. `@/*` → `./src/*`. Scaffold with `npx create-expo-app@latest apps/mobile --template default --no-install --no-agents-md`, strip the demo files, install from the repo root only.
- **A7 — Versions:** always `npx expo install`. SDK 57 pins `react-native 0.86.3`, `react 19.2.3`, `react-native-maps 1.27.2` (Expo Go ships this native code — never upgrade), `react-native-svg 15.15.4`, **`typescript ~6.0.3`** (not 5.9, not 7.x — replaces §2.7's root `typescript ~5.9`). **Drop `react-native-url-polyfill`** (Expo provides URL globally). No `metro.config.js`/`babel.config.js` needed for the workspace; React Compiler and typed routes are on via `experiments`.
- **A8 — Web output stays `single`** (D1). Still: never touch `window`/`localStorage` at module top level; load `maplibre-gl` with dynamic `import()` inside an effect; give modules with import-time side effects (e.g. `expo-notifications`) a `.web.ts` stub so they never enter the web bundle.
- **A9 — maplibre-gl 6 on web:** named exports only; its worker must be self-hosted: `apps/mobile/scripts/copy-maplibre-worker.js` runs on `postinstall` and copies `maplibre-gl/dist/maplibre-gl-worker.mjs` into `apps/mobile/public/` (gitignored copy); the map calls `setWorkerUrl('/maplibre-gl-worker.mjs')`. CSS via `import 'maplibre-gl/dist/maplibre-gl.css'` in `VenueMap.web.tsx`. Keep the attribution control on (OpenFreeMap © OpenMapTiles, data © OpenStreetMap).
- **A10 — Native dark map:** in react-native-maps 1.27.2 `userInterfaceStyle` works on both iOS and Android; on Android it's read only at creation → remount with `key={scheme}` on Android. No `customMapStyle` JSON needed (replaces the §2.4 note).
- **A11 — TS without `expo start`:** commit `apps/mobile/src/types/expo.d.ts` with `/// <reference types="expo/types" />` so `tsc --noEmit` passes on a fresh clone. `npx expo lint` may crash on its very first run ("Cannot find module 'eslint'") — just run it again.
- **A12 — Supabase client:** `supabase` is always a non-null `SupabaseClient<Database>`; also export `isSupabaseConfigured`. If env is missing, create the client against `http://127.0.0.1:44321` with a placeholder key (no crash on import) and show a visible dev-only banner in the root layout. Storage: AsyncStorage on native, default localStorage on web (accessed lazily). No `lock: processLock` (deprecated no-op).
- **A13 — Tabs:** use the JS `Tabs` from expo-router (custom SVG icons, badge, identical on all platforms), not NativeTabs.
- **A14 — Env names (apps/mobile/.env.example):** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_EAS_PROJECT_ID` (optional), `EXPO_PUBLIC_MAP_STYLE_LIGHT`/`_DARK` (optional overrides), `GOOGLE_MAPS_ANDROID_API_KEY`/`GOOGLE_MAPS_IOS_API_KEY` (only for standalone builds, read in `app.config.ts` via the `react-native-maps` config plugin's `androidGoogleMapsApiKey`/`iosGoogleMapsApiKey`; Expo Go needs none). Expo loads `.env` from `apps/mobile/`, not the repo root.
- **A16 — Card previews (migration 18):** `EventCardRow.participants_preview: ParticipantPreview[] | null` (≤4 `going`, organizer first, blocked pairs excluded, **NULL for anon**) so cards show who's going without opening; `CandidateRow`/`PersonSummaryRow.common_slots: string[]` (only the overlap of both schedules as `slotKey`s — never the other person's full schedule). `Database` is exported from the hand-written overlay `packages/shared/src/database.ts`, which narrows generated `Json` columns to these interfaces; `npm run db:types` regenerates only `database.types.ts`.
- **A17 — Local Supabase ports are 44320–44329** (API 44321, DB 44322, Studio 44323, Mailpit 44324, analytics 44327, pooler 44329), not the CLI defaults 543xx. Windows/Hyper-V reserves random blocks inside the dynamic port range (49152–65535) at boot — on the dev machine 53530–54429 was taken, so `supabase start` failed to bind. Ports below 49152 are never auto-reserved. Reverting = edit the `port` keys in `supabase/config.toml` + `apps/mobile/.env` + the vault secret `bojo_functions_url`.
- **A18 — Privacy & abuse hardening after the independent security review (migrations 20–21; supersedes §8 points 1–3 where they differ):**
  - **Cross-user distance** is computed only between centres of a coarse ~2 km grid (lat 0.02° × lng 0.03°) and bucketed to `3 / 5 / 10 / 15 / 25` km (UI: «до 3 км», «~N км», «20+ км»). The stored home point stays at the ~550 m snap and is used only server-side (nearby-event notifications). `score_distance`/`score` derive from the bucket only — the review showed the previous continuous `score_distance` revealed the exact home distance (trilaterated to a single 550 m cell).
  - **Home moves:** free before onboarding and once after; then 1 change per 7 days (clear doesn't reset it).
  - **`person_summary`** returns distance and `common_slots` only with an active match or when the target is discoverable and the caller onboarded; `common_slots` is full only for a match, otherwise capped at 3 (also in `match_candidates`).
  - **Auth:** email OTP only — `enable_confirmations = true` and a custom-access-token hook (`private.auth_token_hook`) rejects password logins with 403 (closes pre-account takeover via password sign-up). Production must wire the same hook in the dashboard.
  - **Other:** `event_series` hidden across blocks; `venues.created_by` / `venue_photos.uploaded_by` not readable by clients; ≤5 push tokens per user and capped push batches; the `joined` system message only once per user/event; global `revoke execute on functions from public` + pgTAP allow-list of executable RPCs; report auto-hide counts only onboarded accounts older than 3 days; venue-photo storage policy fixed (was unusable); notification URLs pass one `isSafeInternalUrl` check.
- **A15 — Runtime notes for README:** prefer Node 22/24 LTS (Node 25 defines a broken global `localStorage` that breaks some libs during server rendering); Expo Go on iOS for SDK 57 requires `npx expo login` with the same account in the app; remote push doesn't work in Expo Go on Android.

---

Status: binding contract for implementation workstreams **(a)**, **(b1)**, **(b2)**, **(c)** and **(d)**. If code and this document disagree, the document wins. Raise the conflict in your report; don't silently diverge. Names in `code` font (tables, columns, functions, files, routes, i18n namespaces) are exact.

Verified on 2026‑10‑15: `expo@57.0.29` is current. Its `bundledNativeModules.json` pins `react-native 0.86.3`, `react 19.2.3`, `react-native-maps 1.27.2`, `expo-router ~57.0.27` and `react-native-reanimated 4.5.1` (with `react-native-worklets 0.10.1`). The task statement says RN 0.87. Always install with `npx expo install` and accept the version it pins. All five OpenFreeMap styles (`liberty`, `bright`, `positron`, `dark`, `fiord`) return 200. The Warsaw OSM relation is **336075** (`admin_level=6`). Public Overpass mirrors were returning 502/500 at check time, so the import script must cache results and support fallback endpoints.

---

## 1. Overview & key decisions

Bojo is "find someone to play sport with today". The launch city is Warsaw. The app is universal: iOS, Android and web from a single Expo Router codebase, running in Expo Go during development.

| # | Decision | Justification |
|---|---|---|
| D1 | **Expo SDK 57 + Expo Router, TypeScript, web output `single` (SPA)** | One codebase for 3 platforms. SPA web output avoids SSR problems with `window`, AsyncStorage and maplibre. |
| D2 | **Maps: `react-native-maps` on iOS/Android, `maplibre-gl` on web, via `VenueMap.tsx` / `VenueMap.web.tsx` behind one props interface** | `react-native-maps` ships in Expo Go (Apple Maps on iOS, Google on Android, no key needed in Expo Go). maplibre-gl with free OpenFreeMap vector styles has no API key and no billing. Metro picks the `.web.tsx` file automatically, so native code never enters the web bundle. |
| D3 | **Supabase: Postgres 17 + PostGIS (`geography(Point,4326)`), Auth, Realtime, Storage, Edge Functions** | One managed backend with good local parity (`npx supabase start`). PostGIS gives indexed radius and bbox queries. |
| D4 | **RPC-first: business logic lives in Postgres functions called via `supabase.rpc()`. Edge Functions only do things SQL can't (HTTP to the Expo push API; the Auth admin API for account deletion)** | Join-with-capacity, matching and chat membership need transactions and row locks, which plpgsql handles in one round-trip. RLS and logic sit side by side. There are fewer deployables, and Edge Functions don't have to re-implement auth checks. |
| D5 | **Scheduling with `pg_cron` (+ `pg_net` to call Edge Functions); secrets for those calls in Supabase Vault** | No extra infra. Materialising recurring events, completing past events and the "nearby event" fan-out are pure SQL jobs. |
| D6 | **Auth: email OTP, 6-digit code** (`signInWithOtp` → `verifyOtp({type:'email'})`) | Works identically on iOS, Android and web without deep links or redirect URLs. Locally, codes arrive in Mailpit (`http://127.0.0.1:44324`). |
| D7 | **Location privacy: user home area stored only in the owner-only table `profile_private`, snapped server-side to a ~550 m grid. Other users only ever get a bucketed distance (`~N km`) and a district name, computed in SECURITY DEFINER functions** | Precise user coordinates are never persisted and never readable cross-user (see §8). |
| D8 | **Anonymous users read only through SECURITY DEFINER RPCs** (`venues_in_bbox`, `venue_detail`, `venue_photos_list`, `events_feed`, `event_detail`). There are no direct table grants to `anon` except the reference tables `districts`, `sports` and `venue_sports` | Anonymous users can see venues and public event cards with counts, but organiser and participant identities are returned as `NULL`. |
| D9 | **Recurring events = `event_series` (weekly rule: ISO weekdays + local start time + until date) + materialised concrete `events` rows for a 14-day horizon** (at creation and in a daily cron) | Every occurrence is a normal event with its own participants, chat, spots and attendance. Idempotent via `unique(series_id, starts_at)`. Avoids RRULE complexity. |
| D10 | **Notifications outbox: the `notifications` table is the in-app inbox, the dedupe log and the push queue.** An insert trigger fires `pg_net` → Edge Function `push-dispatch`, and a 1-minute cron sweep retries | Dedupe through `unique(user_id, dedupe_key)`. Push is optional: when it's unavailable (Expo Go Android, web, no EAS project id), the in-app inbox plus Realtime still work. |
| D11 | **Realtime via `postgres_changes` (RLS-enforced)** on `messages`, `events` and `notifications` only | The simplest secure option for MVP scale. RLS decides who receives each row. |
| D12 | **i18n: i18next + react-i18next + expo-localization, languages `ru` (fallback/default), `pl`, `en`, split into namespaces each owned by one workstream** | Parallel agents never edit the same JSON file. The server stores `profile_private.locale` so push text is localised server-side. |
| D13 | **npm workspaces** (`apps/*`, `packages/*`, `scripts/osm`). Internal dependencies use the version `"*"`, never `workspace:*` (npm doesn't support that protocol) | npm is the only package manager on the machine. Expo SDK ≥52 auto-configures Metro for monorepos. |
| D14 | **`@bojo/shared` is consumed as TypeScript source** (`main: src/index.ts`) with no build step and zero runtime dependencies. It uses erasable TypeScript only: no `enum`, no `namespace` | Metro transpiles it, and Node 25 can run its tests with native type stripping. |
| D15 | **Time: everything is stored as `timestamptz` (UTC). Business calendar logic (today/weekend, weekly slots, series) uses `Europe/Warsaw`** | One city at launch. The timezone is a column on `event_series` for later expansion. |
| D16 | **IDs are UUIDs. OSM venues get deterministic UUID v5 ids from `osm/<type>/<id>`** | Re-imports are stable and the seed is diffable. |
| D17 | **RPC errors: `raise exception '<code>'` where `<code>` comes from the closed list in §5.0.** The client maps `error.message` to the i18n key `errors:<code>` | Stable and translatable, with no string parsing. |
| D18 | **Styling: React Native `StyleSheet` + our own theme tokens (light/dark/system)** | Set as a fixed decision. Tokens in §2.6. |

---

## 2. Monorepo layout

### 2.1 Directory tree and ownership

The owner of each path is shown in brackets. **Only the owner may create or edit files under that path.** (b1) creates placeholder files for routes and cross-feature barrels owned by others (§2.4). Ownership of those files transfers to the listed owner in wave B.

```
bojo/                                        (repo root)
├─ package.json                  [b1] name "bojo", private, workspaces, root scripts (§2.7)
├─ package-lock.json             [b1] (others: never commit lockfile changes; request deps in report)
├─ tsconfig.base.json            [b1] strict, noUncheckedIndexedAccess, erasableSyntaxOnly
├─ .gitignore .editorconfig .prettierrc.json   [b1]
├─ .env.example                  [b1] index of all env vars → points to per-package .env.example
├─ ARCHITECTURE.md  TASKS.md  README.md (README written at integration)
├─ apps/
│  └─ mobile/                    package "@bojo/mobile"
│     ├─ package.json app.config.ts tsconfig.json metro.config.js eslint.config.js .env.example  [b1]
│     ├─ assets/                 [b1] icon.png, adaptive-icon.png, splash.png, favicon.png
│     ├─ app/                    expo-router routes (§2.2)
│     └─ src/
│        ├─ theme/               [b1] tokens.ts, ThemeProvider.tsx, index.ts
│        ├─ components/ui/       [b1] design-system primitives (§2.6) + index.ts
│        ├─ icons/               [b1] Icon.tsx, SportIcon.tsx, index.ts
│        ├─ lib/                 [b1] supabase.ts, queryClient.ts, queryKeys.ts, auth.tsx, errors.ts,
│        │                            storage.ts, location.ts, datetime.ts, format.ts, storageKeys.ts
│        ├─ i18n/                [b1] index.ts ; locales/{ru,pl,en}/<namespace>.json (ownership §2.5)
│        └─ features/
│           ├─ venues/           [b2] VenueMap.tsx, VenueMap.web.tsx, VenueMap.types.ts, api.ts, components/, index.ts
│           ├─ events/           [c]  api.ts, EventCard.tsx, create/ (draft context), components/, index.ts
│           ├─ chat/             [c]  api.ts, ChatView.tsx, components/, index.ts
│           ├─ notifications/    [c]  NotificationsBridge.tsx, push.ts, api.ts, index.ts
│           ├─ onboarding/       [d]
│           ├─ profile/          [d]
│           ├─ people/           [d]  SwipeDeck.tsx, api.ts …
│           ├─ runs/             [d]
│           └─ safety/           [d]  ReportSheet.tsx, useBlockUser.ts, index.ts
├─ packages/
│  └─ shared/                    package "@bojo/shared"                                  [a]
│     ├─ package.json  tsconfig.json
│     └─ src/ index.ts database.types.ts rpc.types.ts enums.ts sports.ts levels.ts districts.ts
│            availability.ts scoring.ts distance.ts errors.ts storage.ts constants.ts
│            notifications.ts __tests__/scoring.test.ts
├─ supabase/                                                                            [a]
│  ├─ config.toml
│  ├─ templates/otp.html
│  ├─ migrations/                (§3–§7; suggested split in §11.2)
│  ├─ seeds/ 00_local_vault.sql 10_districts_osm.sql 20_venues_osm.sql 90_dev_mock.sql
│  ├─ tests/                     pgTAP RLS/privacy tests (*.test.sql)
│  └─ functions/
│     ├─ deno.json  .env.example
│     ├─ _shared/cors.ts
│     ├─ push-dispatch/index.ts, templates.ts
│     └─ delete-account/index.ts
└─ scripts/
   └─ osm/                       package "@bojo/osm-import"                               [a]
      ├─ package.json tsconfig.json README.md
      ├─ src/ overpass.ts mapping.ts build-venues.ts build-districts.ts sql.ts main.ts
      └─ .cache/                 (gitignored raw Overpass responses)
```

### 2.2 Expo Router route tree

```
app/
├─ _layout.tsx                 [b1] providers + root <Stack>; onboarding redirect; mounts <NotificationsBridge/>
├─ +not-found.tsx              [b1]
├─ sign-in.tsx                 [b1] modal; email → 6-digit code; param ?next=<path>
├─ (tabs)/
│  ├─ _layout.tsx              [b1] <Tabs> order: index, events, people, chats, profile; chats badge = useUnreadTotal()
│  ├─ index.tsx                [b2] MAP (first/main tab)
│  ├─ events.tsx               [c]  feed (filters) + segment "My events"
│  ├─ people.tsx               [d]  swipe deck
│  ├─ chats.tsx                [c]  conversation list (matches + event chats)
│  └─ profile.tsx              [d]  my profile
├─ venue/
│  ├─ new.tsx                  [b2] add venue (auth) ?lat&lng
│  └─ [id]/
│     ├─ index.tsx             [b2] venue detail
│     └─ edit.tsx              [b2] suggest correction / report closed (auth)
├─ event/
│  ├─ create/
│  │  ├─ _layout.tsx           [c]  nested Stack + CreateEventDraft context; params ?venueId&sportId&matchId
│  │  ├─ index.tsx             [c]  step 1 sport
│  │  ├─ venue.tsx             [c]  step 2 venue (VenueMap + nearby list)
│  │  ├─ time.tsx              [c]  step 3 time (quick chips)
│  │  └─ details.tsx           [c]  step 4 spots/level/repeat → create (or propose_meeting if matchId)
│  └─ [id]/
│     ├─ index.tsx             [c]  event detail
│     └─ attendance.tsx        [c]  organizer marks showed / no-show
├─ chat/[id].tsx               [c]  conversation (event or match), id = conversations.id
├─ notifications.tsx           [c]  in-app inbox
├─ person/[id].tsx             [d]  public profile, id = profiles.id
├─ onboarding/
│  ├─ _layout.tsx              [d]
│  ├─ index.tsx                [d]  name + avatar
│  ├─ sports.tsx               [d]  sports + level per sport
│  ├─ availability.tsx         [d]  weekly grid (7 × 3 day parts)
│  └─ area.tsx                 [d]  district + optional home area + goal → complete_onboarding
├─ edit-profile.tsx            [d]
├─ settings.tsx                [d]  theme, language, notify radius, push toggle, blocked users, sign out, delete account
└─ runs/index.tsx              [d]  running stub
```

Static segments (`event/create`, `venue/new`) take precedence over dynamic ones (`event/[id]`, `venue/[id]`).

**Auth gating** (b1, in `app/_layout.tsx` + `src/lib/auth.tsx`):
- The Map and Events tabs, plus `venue/[id]` and `event/[id]`, work for anonymous users.
- All other actions call `useRequireAuth()`. If there's no session, it pushes `/sign-in?next=<current path>` and returns `false`.
- If the user has a session but `profile.onboarded_at == null` and the current segment isn't `onboarding`, the root layout renders `<Redirect href="/onboarding" />`.
- The People, Chats and Profile tabs render an `EmptyState` with a "Sign in" button when anonymous. Each owner implements this inside their own tab.

**Deep links / push targets** (`data.url` in push payloads): `/event/<id>`, `/event/<id>/attendance`, `/chat/<conversationId>`, `/person/<userId>`, `/notifications`.

### 2.3 Workstreams

| WS | Scope | Owns |
|---|---|---|
| **a** DB/backend | migrations, RLS, RPC, triggers, cron, storage, realtime, Edge Functions, seeds, OSM import, shared TS contract, pgTAP tests | `supabase/**`, `packages/shared/**`, `scripts/osm/**` |
| **b1** Foundation | root workspace, Expo app scaffold + all npm deps, app config, navigation shell, theme/dark mode, UI kit, icons, i18n infra + vocab namespaces, Supabase client, auth (OTP), React Query setup, lib helpers, placeholder routes + cross-feature stubs | root files, `apps/mobile/*` config, `app/_layout.tsx`, `app/+not-found.tsx`, `app/sign-in.tsx`, `app/(tabs)/_layout.tsx`, `src/theme/**`, `src/components/ui/**`, `src/icons/**`, `src/lib/**`, `src/i18n/index.ts`, i18n ns `common`, `auth`, `errors`, `vocab` |
| **b2** Map & venues | map tab, `VenueMap` (native+web), venue detail, photos upload, add venue, suggest edit | `app/(tabs)/index.tsx`, `app/venue/**`, `src/features/venues/**`, ns `map`, `venues` |
| **c** Events + chats | feed + filters, my events, event detail, join/leave/cancel, participants, create flow (≤4 taps) incl. recurring + propose-meeting mode, attendance, generic chat (event + match), chats list, notifications inbox + push registration | `app/(tabs)/events.tsx`, `app/(tabs)/chats.tsx`, `app/event/**`, `app/chat/**`, `app/notifications.tsx`, `src/features/{events,chat,notifications}/**`, ns `events`, `chat`, `notifications` |
| **d** Profile, onboarding, matching, runs, safety | onboarding, profile view/edit, settings, swipe deck + match modal, person screen, block/report UI, runs stub | `app/(tabs)/people.tsx`, `app/(tabs)/profile.tsx`, `app/onboarding/**`, `app/person/**`, `app/runs/**`, `app/settings.tsx`, `app/edit-profile.tsx`, `src/features/{onboarding,profile,people,runs,safety}/**`, ns `onboarding`, `profile`, `people`, `runs`, `safety`, `settings` |

### 2.4 Cross-feature public API

These modules are imported by other workstreams. In wave A, **b1 creates them as typed stubs** with exactly these signatures, plus a minimal placeholder body (for example `VenueMap` renders a grey `View` with text). The owner replaces the body in wave B and **must not change the signature**. Import only from the barrel `@/features/<name>`, never from deep paths.

| Barrel | Owner | Export | Signature | Used by |
|---|---|---|---|---|
| `@/features/venues` | b2 | `VenueMap` | `(props: VenueMapProps) => React.JSX.Element` | c (create step 2), d (onboarding area pick) |
| | | `useVenuesInBbox` | `(bbox: BBox \| null, sportIds?: string[] \| null) => UseQueryResult<VenueMapRow[]>` | c |
| | | `type VenueMapProps`, `type VenueMapItem` | see below | c, d |
| `@/features/events` | c | `EventCard` | `(p: { event: EventCardRow; onPress?: () => void; compact?: boolean }) => JSX.Element` | b2 (venue detail), d (runs stub) |
| | | `useEventsFeed` | `(params: EventsFeedParams, opts?: { enabled?: boolean }) => UseQueryResult<EventCardRow[]>` | b2, d |
| `@/features/notifications` | c | `NotificationsBridge` | `() => null`. Registers push, handles notification taps → `router.push(data.url)`, and subscribes to Realtime `notifications` for an in-app toast | b1 root layout |
| `@/features/chat` | c | `useUnreadTotal` | `() => number` (sum of `unread_count` from `my_conversations`; 0 when anonymous) | b1 tabs layout |
| `@/features/safety` | d | `ReportSheet` | `(p: { visible: boolean; onClose: () => void; targetType: ReportTarget; targetId: string }) => JSX.Element` | b2, c |
| | | `useBlockUser` | `() => { block: (userId: string) => Promise<void>; unblock: (userId: string) => Promise<void>; isPending: boolean }` | c |

```ts
// src/features/venues/VenueMap.types.ts  (exact)
import type { StyleProp, ViewStyle } from 'react-native';
import type { BBox, VenueKind } from '@bojo/shared';
export interface VenueMapItem {
  id: string; lat: number; lng: number; name: string | null; kind: VenueKind;
  sportIds: string[]; upcomingEventsCount: number;
}
export interface MapViewport extends BBox { zoom: number }
export interface VenueMapProps {
  venues: VenueMapItem[];
  initialCenter?: { lat: number; lng: number };      // default WARSAW_CENTER
  initialZoom?: number;                              // default 12
  selectedVenueId?: string | null;
  onSelectVenue?: (venueId: string) => void;
  onViewportChange?: (v: MapViewport) => void;       // debounced 300 ms inside the component
  userLocation?: { lat: number; lng: number } | null; // own device location dot; never sent elsewhere
  pickMode?: boolean;                                // shows a centre crosshair; hides venue markers if venues=[]
  onPickLocation?: (p: { lat: number; lng: number }) => void; // fired on "confirm" in pickMode
  style?: StyleProp<ViewStyle>;
}
```
VenueMap handles clustering (`supercluster`, both platforms), dark style (Android `customMapStyle`, iOS `userInterfaceStyle`, web OpenFreeMap `dark` style) and the OSM attribution overlay.

**Route contracts:**
- c's create flow accepts `?venueId=<uuid>` (skips step 2), `?sportId=<id>` (skips step 1) and `?matchId=<uuid>`. With `matchId`, the flow calls `propose_meeting`, hides the spots/level/repeat options and on success navigates to `/chat/<conversation_id>`.
- b2's "Create event here" button: `router.push({ pathname: '/event/create', params: { venueId } })`.
- d's "Propose a meeting" button: `router.push({ pathname: '/event/create', params: { matchId, sportId } })`.
- After a match, d navigates to `/chat/<conversation_id>`.

### 2.5 i18n

- `src/i18n/index.ts` [b1] statically imports **every** namespace file for `ru`, `pl` and `en`. b1 creates all of them in wave A as `{}`, so imports resolve.
- Languages: `supportedLngs: ['ru','pl','en']`, `fallbackLng: 'ru'`. The initial language is the saved value (`AsyncStorage['bojo.language']`), then the device locale if supported, then `'ru'`.
- Import the `intl-pluralrules` polyfill first. Plural keys use the i18next v21+ suffixes (`_one/_few/_many/_other`).
- `setLanguage(lng)` [b1] persists the choice and, when logged in, runs `update profile_private set locale`.

| Namespace | Owner | Content |
|---|---|---|
| `common` | b1 | buttons, generic states, tab titles, OSM attribution |
| `auth` | b1 | sign-in screens |
| `errors` | b1 | one key per RPC error code (§5.0) + `network`, `unknown` |
| `vocab` | b1 | `sports.<id>`, `levels.<1..5>`, `levels.any`, `districts.<key>`, `weekdays.<1..7>`, `dayParts.<part>`, `goals.<goal>`, `venueKinds.<kind>`, `surfaces.<osm value>`, `distance.lte1` / `approx` / `gte30` |
| `map`, `venues` | b2 | |
| `events`, `chat`, `notifications` | c | `notifications` also holds in-app texts per `notification_type` |
| `onboarding`, `profile`, `people`, `runs`, `safety`, `settings` | d | |

No hard-coded user-facing strings anywhere. A key must exist in all 3 languages; `ru` is the source of truth.

### 2.6 Foundation APIs (b1) other workstreams code against

**Theme** (`@/theme`):
```ts
export type ThemeMode = 'system' | 'light' | 'dark';
export interface Theme {
  scheme: 'light' | 'dark';
  colors: {
    background: string; surface: string; surfaceAlt: string; border: string;
    text: string; textMuted: string; textInverse: string;
    primary: string; primaryPressed: string; onPrimary: string;
    accent: string; success: string; warning: string; danger: string;
    overlay: string; skeleton: string; mapMarker: string; mapMarkerSelected: string;
    sport: Record<SportId, string>;
  };
  spacing: { xxs: 2; xs: 4; sm: 8; md: 12; lg: 16; xl: 24; xxl: 32 };
  radius: { sm: 6; md: 10; lg: 16; xl: 24; pill: 999 };
  typography: Record<'title'|'heading'|'body'|'bodyStrong'|'caption'|'label'|'number', TextStyle>;
  minTouch: 44;
}
export function useTheme(): Theme;
export function useThemeMode(): { mode: ThemeMode; setMode(m: ThemeMode): void }; // persisted 'bojo.theme'
```
Suggested palette: primary green `#16A34A` light / `#22C55E` dark, accent `#F97316`. Sport colours: football `#16A34A`, basketball `#EA580C`, volleyball `#EAB308`, tennis `#84CC16`, padel `#06B6D4`, table_tennis `#3B82F6`, swimming `#0EA5E9`, workout `#A855F7`, running `#EF4444`. Dark background `#0B0F14`, surface `#151B23`.

**UI kit** (`@/components/ui`): `Screen {scroll?, padded?, edges?}`, `Text {variant, color?, numberOfLines?}`, `Button {title, onPress, variant: 'primary'|'secondary'|'ghost'|'danger', size?: 'md'|'lg', loading?, disabled?, icon?}`, `IconButton {icon, onPress, accessibilityLabel}`, `Chip {label, selected?, onPress?, icon?}`, `Card {onPress?, children}`, `Avatar {path?: string|null, name: string, size?: number}` (resolves the `avatars` public URL, initials fallback), `Badge {label, tone: 'neutral'|'success'|'warning'|'danger'|'primary'}`, `TextField {label, value, onChangeText, error?, ...TextInputProps}`, `OtpInput {length: 6, value, onChange}`, `Stepper {value, min, max, onChange, label}`, `Segmented<T> {options: {value:T,label:string}[], value, onChange}`, `Sheet {visible, onClose, title?, children}` (Modal-based bottom sheet), `EmptyState {icon, title, message?, action?}`, `ErrorState {error: unknown, onRetry?}`, `Skeleton {width, height, radius?}`, `ListItem {title, subtitle?, left?, right?, onPress?}`, `Toast` (via `useToast().show(text, tone)`).

**Icons** (`@/icons`): `Icon {name: MaterialCommunityIcons name, size?, color?}` and `SportIcon {sportId: string, size?, color?}`. The MaterialCommunityIcons names come from `SPORTS[].icon`.

**lib** (`@/lib/...`):
- `supabase.ts`: `export const supabase: SupabaseClient<Database>`. Native uses AsyncStorage for the session; web uses the default localStorage. `detectSessionInUrl: false`. AppState toggles `startAutoRefresh` / `stopAutoRefresh`. `import 'react-native-url-polyfill/auto'` comes first.
- `auth.tsx`: `AuthProvider` and `useAuth(): { session; userId: string|null; profile: ProfileRow|null; isLoading: boolean; refreshProfile(): Promise<void>; signOut(): Promise<void> }`. `signOut` first calls `unregister_push_token` if `AsyncStorage[STORAGE_KEYS.pushToken]` exists. Also exports `useRequireAuth(): (next?: string) => boolean`.
- `errors.ts`: `getRpcErrorCode(e: unknown): RpcErrorCode | 'network' | 'unknown'` and `useErrorText(): (e: unknown) => string`.
- `storage.ts`: `publicUrl(bucket: BucketId, path: string): string`. `uploadImage({ bucket, path, uri }): Promise<string>` resizes to max 1600 px, re-encodes JPEG q=0.8 with `expo-image-manipulator` (this **strips EXIF/GPS**), uploads an ArrayBuffer with `contentType: 'image/jpeg'`, and returns the path.
- `location.ts`: `getCurrentLocation(): Promise<{lat:number;lng:number}|null>` (foreground permission; `null` if denied or unavailable) and `roundCoord(n: number, decimals = 3): number`.
- `datetime.ts`: `TZ = 'Europe/Warsaw'`, `warsawDateTimeISO(dayOffset: number, hh: number, mm: number): string`, `formatEventWhen(iso, locale)` (e.g. "Today 18:00", "Sat 12 Oct, 10:00"), `formatTime`, `formatDate`. Uses `date-fns` + `@date-fns/tz`.
- `format.ts`: `venueDisplayName(name: string|null, kind: VenueKind, t): string`, `formatApproxDistance(km: number|null, t): string`, `formatPace(secPerKm: number): string`, `spotsLeft(row: {spots_total;spots_taken;spots_reserved}): number`.
- `queryKeys.ts`: the `qk` object (Appendix B).
- `storageKeys.ts`: `STORAGE_KEYS = { theme: 'bojo.theme', language: 'bojo.language', pushToken: 'bojo.pushToken' } as const`.

**Data-layer conventions:**
- One `api.ts` per feature exporting React Query hooks (`useXxx`, `useXxxMutation`).
- RPC results are annotated with `@bojo/shared` row types: `const rows: EventCardRow[] = data ?? []`.
- Mutations invalidate the keys listed in Appendix B.
- Defaults: `staleTime` 30 s, `retry: 1`, refetch on app focus (`focusManager` + AppState).

### 2.7 Packages, scripts, env

**Root `package.json`:**
```json
{ "name": "bojo", "private": true,
  "workspaces": ["apps/*", "packages/*", "scripts/osm"],
  "scripts": {
    "dev": "npm run start -w @bojo/mobile", "web": "npm run web -w @bojo/mobile",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "db:start": "supabase start", "db:stop": "supabase stop", "db:reset": "supabase db reset",
    "db:test": "supabase test db",
    "db:types": "supabase gen types typescript --local --schema public > packages/shared/src/database.types.ts",
    "functions:serve": "supabase functions serve --env-file supabase/functions/.env",
    "osm:import": "npm run import -w @bojo/osm-import" },
  "devDependencies": { "supabase": "^2.121.0", "typescript": "~5.9", "prettier": "^3" } }
```

**`apps/mobile` dependencies** (b1 installs them all in wave A via `npx expo install …`; wave-B agents must not add dependencies):
`expo`, `expo-router`, `react`, `react-dom`, `react-native`, `react-native-web`, `react-native-screens`, `react-native-safe-area-context`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets`, `expo-status-bar`, `expo-system-ui`, `expo-splash-screen`, `expo-constants`, `expo-linking`, `expo-font`, `@expo/vector-icons`, `expo-localization`, `expo-location`, `expo-notifications`, `expo-device`, `expo-image`, `expo-image-picker`, `expo-image-manipulator`, `expo-crypto`, `expo-haptics`, `@react-native-async-storage/async-storage`, `react-native-maps`, `maplibre-gl`, `supercluster`, `@supabase/supabase-js`, `@tanstack/react-query`, `i18next`, `react-i18next`, `intl-pluralrules`, `react-native-url-polyfill`, `date-fns`, `@date-fns/tz`, `@bojo/shared: "*"`.
devDependencies: `typescript`, `@types/react`, `@types/supercluster`, `eslint`, `eslint-config-expo`.
Scripts: `start`, `web`, `typecheck` (`tsc --noEmit`), `lint` (`expo lint`).

**`app.config.ts`** (b1):
- `name: 'Bojo'`, `slug: 'bojo'`, `scheme: 'bojo'`, `userInterfaceStyle: 'automatic'`, `web: { bundler: 'metro', output: 'single' }`.
- Plugins: `expo-router`, `expo-localization`, `expo-location` (when-in-use text), `expo-image-picker` (photos text), `expo-notifications`.
- `extra.eas.projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || undefined`.

**ESLint** (b1): a `no-restricted-imports` rule bans `react-native-maps` and `maplibre-gl` everywhere except `src/features/venues/VenueMap.tsx` and `src/features/venues/VenueMap.web.tsx` respectively.

**`packages/shared/package.json`:** `{ "name": "@bojo/shared", "version": "0.0.0", "private": true, "main": "src/index.ts", "types": "src/index.ts", "scripts": { "typecheck": "tsc --noEmit", "test": "node --test src/__tests__/" } }`

**`scripts/osm/package.json`:** name `@bojo/osm-import`. Dependencies: `osmtogeojson`, `@turf/simplify`, `uuid`; devDependency `tsx`. Script `"import": "tsx src/main.ts"`.

**Env files** (only `*.example` files are committed; real `.env` files are gitignored):

| File | Variables |
|---|---|
| `apps/mobile/.env.example` | `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:44321` (on a phone in Expo Go use your PC's LAN IP; on the Android emulator `http://10.0.2.2:44321`) · `EXPO_PUBLIC_SUPABASE_ANON_KEY=` (anon JWT or `sb_publishable_…` from `npx supabase status`) · `EXPO_PUBLIC_EAS_PROJECT_ID=` (optional; without it remote push is disabled) · `EXPO_PUBLIC_MAP_STYLE_LIGHT=https://tiles.openfreemap.org/styles/liberty` · `EXPO_PUBLIC_MAP_STYLE_DARK=https://tiles.openfreemap.org/styles/dark` |
| `supabase/functions/.env.example` | `PUSH_DISPATCH_SECRET=local-dev-dispatch-secret` · `EXPO_ACCESS_TOKEN=` (optional) |
| `scripts/osm/.env.example` | `OVERPASS_URL=https://overpass-api.de/api/interpreter` · `OVERPASS_FALLBACK_URLS=https://overpass.private.coffee/api/interpreter,https://overpass.kumi.systems/api/interpreter` · `OVERPASS_CONTACT=` (put in User-Agent) |

The service role key never appears in the app or in any `EXPO_PUBLIC_*` variable.

---

## 3. Database schema

### 3.0 Conventions

- Extensions and schemas: `create extension if not exists postgis with schema extensions; create extension if not exists pg_net with schema extensions; create extension if not exists pg_cron; create schema if not exists private;`
- Geography type: `extensions.geography(...)`. Every function has `set search_path = public, extensions, pg_temp`. Functions in `private` are always called schema-qualified.
- The `private` schema is **not** exposed by PostgREST (`[api] schemas = ["public","graphql_public"]`). It holds helpers, trigger functions, cron functions and `private.moderators`.
- Every table has a uuid or composite PK. `created_at timestamptz not null default now()`. `updated_at` is maintained by trigger `private.tg_set_updated_at()` on: profiles, profile_private, venues, events, ratings, runner_profiles.
- No PL/pgSQL function is overloaded (PostgREST ambiguity).

### 3.1 Enums (schema `public`)

```sql
create type public.venue_kind          as enum ('pitch','sports_centre','swimming_pool','fitness_station','track','running_route','other');
create type public.venue_source        as enum ('osm','user');
create type public.moderation_status   as enum ('active','pending','hidden');
create type public.venue_edit_kind     as enum ('create','update','close');
create type public.edit_status         as enum ('pending','approved','rejected');
create type public.event_status        as enum ('scheduled','cancelled','completed');
create type public.event_visibility    as enum ('public','private');
create type public.participant_status  as enum ('invited','going','left','removed');
create type public.conversation_kind   as enum ('event','match');
create type public.message_kind        as enum ('text','system','event_invite');
create type public.match_status        as enum ('active','unmatched');
create type public.day_part            as enum ('morning','afternoon','evening');   -- 06–12, 12–17, 17–23 Europe/Warsaw
create type public.user_goal           as enum ('fun','fitness','competition','learning');
create type public.report_target       as enum ('user','event','venue','venue_photo','message');
create type public.report_reason       as enum ('spam','abuse','fake','no_show','inappropriate','wrong_info','other');
create type public.report_status       as enum ('open','reviewed','dismissed');
create type public.notification_type   as enum ('event_nearby','event_joined','event_cancelled','event_invite','match','message','attendance_reminder');
create type public.push_status         as enum ('pending','sending','sent','skipped','failed');
create type public.push_platform       as enum ('ios','android');
create type public.run_source          as enum ('manual','strava','apple_health','google_fit');
```

### 3.2 Reference tables

```sql
create table public.districts (
  key        text primary key check (key ~ '^[a-z_]+$'),
  name       text not null,                                  -- official Polish name
  center     extensions.geography(Point,4326) not null,      -- approximate centroid (migration-seeded)
  boundary   extensions.geography(MultiPolygon,4326),        -- filled by seeds/10_districts_osm.sql (nullable)
  sort_order smallint not null
);
create index districts_boundary_gix on public.districts using gist (boundary);
create index districts_center_gix   on public.districts using gist (center);

create table public.sports (
  id                   text primary key check (id ~ '^[a-z_]+$'),
  sort_order           smallint not null,
  icon                 text not null,                        -- MaterialCommunityIcons name
  default_spots        smallint not null check (default_spots between 2 and 50),
  default_duration_min smallint not null check (default_duration_min between 15 and 480),
  is_team              boolean not null default false,
  osm_values           text[] not null default '{}',         -- OSM sport=* values mapped to this sport
  is_active            boolean not null default true
);
```
The migration inserts the 18 districts (§9.4) and the 9 sports (§9.3) with explicit column lists.

### 3.3 People

```sql
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text not null default '' check (char_length(display_name) <= 40),
  avatar_path       text check (avatar_path is null or char_length(avatar_path) <= 200),  -- 'avatars' bucket path "<id>/<uuid>.jpg"
  bio               text check (bio is null or char_length(bio) <= 300),
  district_key      text references public.districts(key),
  goal              public.user_goal,
  discoverable      boolean not null default true,       -- show in matching
  is_verified       boolean not null default false,      -- SERVER-ONLY
  attended_count    int not null default 0,              -- SERVER-ONLY
  no_show_count     int not null default 0,              -- SERVER-ONLY
  reliability_score smallint check (reliability_score between 0 and 100),  -- SERVER-ONLY; null until >= 3 rated events
  onboarded_at      timestamptz,                         -- SERVER-ONLY (complete_onboarding)
  is_mock           boolean not null default false,      -- SERVER-ONLY
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index profiles_district_idx on public.profiles (district_key);

create table public.profile_private (                     -- OWNER-ONLY. Never joined into anything returned to other users.
  user_id                      uuid primary key references public.profiles(id) on delete cascade,
  home_location                extensions.geography(Point,4326),   -- SERVER-ONLY write (set_home_location), snapped ~550 m
  home_location_updated_at     timestamptz,                         -- SERVER-ONLY
  home_location_changes_on     date,                                -- SERVER-ONLY (rate limit day)
  home_location_changes_count  smallint not null default 0,         -- SERVER-ONLY
  notify_radius_km             smallint not null default 5 check (notify_radius_km between 1 and 30),
  push_enabled                 boolean not null default true,
  locale                       text not null default 'ru' check (locale in ('ru','pl','en')),
  updated_at                   timestamptz not null default now()
);
create index profile_private_home_gix on public.profile_private using gist (home_location);

create table public.user_sports (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  sport_id   text not null references public.sports(id),
  level      smallint not null check (level between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (user_id, sport_id)
);
create index user_sports_sport_idx on public.user_sports (sport_id, level);

create table public.availability_slots (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  weekday  smallint not null check (weekday between 1 and 7),       -- ISO: 1 = Monday
  day_part public.day_part not null,
  primary key (user_id, weekday, day_part)
);

-- Module 4 (running) — STUB
create table public.runner_profiles (
  user_id               uuid primary key references public.profiles(id) on delete cascade,
  pace_fast_sec_per_km  smallint check (pace_fast_sec_per_km between 150 and 900),
  pace_slow_sec_per_km  smallint check (pace_slow_sec_per_km between 150 and 900),
  preferred_distance_km numeric(4,1) check (preferred_distance_km between 1 and 100),
  updated_at            timestamptz not null default now(),
  check (pace_fast_sec_per_km is null or pace_slow_sec_per_km is null or pace_fast_sec_per_km <= pace_slow_sec_per_km)
);
create table public.runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  source      public.run_source not null default 'manual',
  external_id text,
  started_at  timestamptz not null,
  distance_m  int not null check (distance_m between 1 and 500000),
  duration_s  int not null check (duration_s between 1 and 172800),
  created_at  timestamptz not null default now(),
  constraint runs_external_uniq unique (user_id, source, external_id)
);
create index runs_user_started_idx on public.runs (user_id, started_at desc);

create table private.moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
```

### 3.4 Venues

```sql
create table public.venues (
  id                uuid primary key default gen_random_uuid(),     -- OSM rows: uuid v5 of 'osm/<type>/<id>'
  name              text check (name is null or char_length(name) between 1 and 120),  -- OSM often unnamed → UI fallback
  kind              public.venue_kind not null,
  location          extensions.geography(Point,4326) not null,      -- point or centroid of area
  route_path        extensions.geography(LineString,4326),          -- running routes (stub, unused in MVP)
  district_key      text references public.districts(key),          -- SERVER-ONLY (trigger)
  address           text check (address is null or char_length(address) <= 200),
  surface           text check (surface is null or char_length(surface) <= 40),        -- raw OSM surface value
  is_lit            boolean,                                         -- null = unknown
  is_free           boolean,                                         -- OSM fee=no → true, fee=yes → false
  is_indoor         boolean,
  access            text,                                            -- raw OSM access
  opening_hours     text check (opening_hours is null or char_length(opening_hours) <= 255), -- raw OSM syntax
  website           text, phone text,
  source            public.venue_source not null default 'user',
  osm_type          text check (osm_type in ('node','way','relation')),
  osm_id            bigint,
  osm_tags          jsonb,
  osm_imported_at   timestamptz,
  locally_edited_at timestamptz,          -- set when a moderator applies an edit → re-import won't overwrite attributes
  status            public.moderation_status not null default 'active',  -- SERVER-ONLY
  is_mock           boolean not null default false,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint venues_osm_uniq unique (osm_type, osm_id),
  constraint venues_osm_chk  check ((source = 'osm') = (osm_type is not null and osm_id is not null))
);
create index venues_location_gix  on public.venues using gist (location);
create index venues_district_idx  on public.venues (district_key);
create index venues_created_by_idx on public.venues (created_by);

create table public.venue_sports (
  venue_id uuid not null references public.venues(id) on delete cascade,
  sport_id text not null references public.sports(id),
  inferred boolean not null default false,       -- true when derived from OSM sport=multi
  primary key (venue_id, sport_id)
);
create index venue_sports_sport_idx on public.venue_sports (sport_id);

create table public.venue_photos (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues(id) on delete cascade,
  storage_path text,               -- 'venue-photos' bucket: "<venue_id>/<user_id>/<uuid>.jpg"
  external_url text,               -- OSM image / Wikimedia Commons
  attribution  text,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  status       public.moderation_status not null default 'active',   -- SERVER-ONLY
  is_mock      boolean not null default false,
  created_at   timestamptz not null default now(),
  check (storage_path is not null or external_url is not null)
);
create index venue_photos_venue_idx on public.venue_photos (venue_id, created_at desc);
create index venue_photos_uploader_idx on public.venue_photos (uploaded_by);

create table public.venue_edits (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues(id) on delete cascade,
  kind        public.venue_edit_kind not null,
  proposed    jsonb not null default '{}',   -- VenueEditProposal (§9.2); {} for 'close'
  previous    jsonb,                          -- snapshot of the same keys at suggestion time
  comment     text check (comment is null or char_length(comment) <= 500),
  status      public.edit_status not null default 'pending',
  created_by  uuid not null references public.profiles(id) on delete cascade,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index venue_edits_venue_idx  on public.venue_edits (venue_id);
create index venue_edits_status_idx on public.venue_edits (status, created_at);
create index venue_edits_creator_idx on public.venue_edits (created_by, created_at desc);
```

### 3.5 Events

```sql
create table public.event_series (
  id             uuid primary key default gen_random_uuid(),
  organizer_id   uuid not null references public.profiles(id) on delete cascade,
  sport_id       text not null references public.sports(id),
  venue_id       uuid not null references public.venues(id),
  title          text check (title is null or char_length(title) <= 80),
  description    text check (description is null or char_length(description) <= 1000),
  spots_total    smallint not null check (spots_total between 2 and 50),
  spots_reserved smallint not null default 0 check (spots_reserved >= 0),
  level          smallint check (level between 1 and 5),                -- null = any level
  visibility     public.event_visibility not null default 'public',
  weekdays       smallint[] not null check (cardinality(weekdays) between 1 and 7
                                            and weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  start_time     time not null,                                          -- local time in `timezone`
  duration_min   smallint not null check (duration_min between 15 and 480),
  timezone       text not null default 'Europe/Warsaw',
  starts_on      date not null,
  until_on       date check (until_on is null or until_on >= starts_on), -- RPC caps at starts_on + 26 weeks
  is_active      boolean not null default true,
  is_mock        boolean not null default false,
  created_at     timestamptz not null default now(),
  check (spots_reserved <= spots_total - 2)
);
create index event_series_organizer_idx on public.event_series (organizer_id);
create index event_series_active_idx    on public.event_series (id) where is_active;

create table public.events (
  id             uuid primary key default gen_random_uuid(),
  series_id      uuid references public.event_series(id) on delete set null,
  sport_id       text not null references public.sports(id),
  venue_id       uuid not null references public.venues(id),
  organizer_id   uuid not null references public.profiles(id) on delete cascade,
  title          text check (title is null or char_length(title) <= 80),   -- e.g. "5×5"; UI composes fallback
  description    text check (description is null or char_length(description) <= 1000),
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  spots_total    smallint not null check (spots_total between 2 and 50),  -- total players incl. organizer
  spots_taken    smallint not null default 0,      -- SERVER-ONLY: count of participants with status 'going' (trigger)
  spots_reserved smallint not null default 0,      -- players coming without the app ("we are 7, need 3")
  level          smallint check (level between 1 and 5),                  -- null = any level
  visibility     public.event_visibility not null default 'public',      -- 'private' = propose_meeting
  status         public.event_status not null default 'scheduled',      -- SERVER-ONLY
  cancelled_at   timestamptz,
  cancel_reason  text check (cancel_reason is null or char_length(cancel_reason) <= 300),
  is_mock        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint events_time_chk  check (ends_at > starts_at and ends_at <= starts_at + interval '8 hours'),
  constraint events_spots_chk check (spots_taken >= 0 and spots_reserved >= 0
                                     and spots_taken + spots_reserved <= spots_total),
  constraint events_series_start_uniq unique (series_id, starts_at)
);
create index events_starts_sched_idx on public.events (starts_at) where status = 'scheduled';
create index events_venue_starts_idx on public.events (venue_id, starts_at);
create index events_sport_starts_idx on public.events (sport_id, starts_at);
create index events_organizer_idx    on public.events (organizer_id);

create table public.event_participants (
  event_id  uuid not null references public.events(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  status    public.participant_status not null default 'going',
  joined_at timestamptz not null default now(),
  left_at   timestamptz,
  primary key (event_id, user_id)
);
create index event_participants_user_idx  on public.event_participants (user_id, status);
create index event_participants_event_idx on public.event_participants (event_id, status);

create table public.ratings (                 -- attendance / reliability. One row per (event, ratee). MVP rater = organizer.
  event_id   uuid not null references public.events(id) on delete cascade,
  ratee_id   uuid not null references public.profiles(id) on delete cascade,
  rater_id   uuid not null references public.profiles(id) on delete cascade,
  attended   boolean not null,                -- true = showed up, false = no-show
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, ratee_id),
  check (rater_id <> ratee_id)
);
create index ratings_ratee_idx on public.ratings (ratee_id);
```
**Spots semantics:**
- `spots_left = spots_total - spots_taken - spots_reserved`.
- The organizer is a `going` participant, so a new event has `spots_taken = 1`.
- UI step 4 shows "Total players" (default `sports.default_spots`) and "Already have, incl. you" (default 1). `spots_reserved = already_have - 1`.
- Invited participants do **not** count towards spots.

### 3.6 Social: matching, chat, safety, notifications

```sql
create table public.swipes (
  swiper_id  uuid not null references public.profiles(id) on delete cascade,
  target_id  uuid not null references public.profiles(id) on delete cascade,
  liked      boolean not null,
  sport_id   text references public.sports(id),
  created_at timestamptz not null default now(),
  primary key (swiper_id, target_id),
  check (swiper_id <> target_id)
);
create index swipes_target_liked_idx on public.swipes (target_id) where liked;

create table public.matches (
  id           uuid primary key default gen_random_uuid(),
  user_a       uuid not null references public.profiles(id) on delete cascade,   -- canonical: user_a < user_b
  user_b       uuid not null references public.profiles(id) on delete cascade,
  status       public.match_status not null default 'active',
  created_at   timestamptz not null default now(),
  unmatched_at timestamptz,
  constraint matches_order_chk check (user_a < user_b),
  constraint matches_pair_uniq unique (user_a, user_b)
);
create index matches_user_b_idx on public.matches (user_b);

create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  kind            public.conversation_kind not null,
  event_id        uuid unique references public.events(id) on delete cascade,
  match_id        uuid unique references public.matches(id) on delete cascade,
  last_message_at timestamptz,                                      -- trigger-maintained
  created_at      timestamptz not null default now(),
  constraint conversations_kind_chk check (
    (kind = 'event' and event_id is not null and match_id is null) or
    (kind = 'match' and match_id is not null and event_id is null))
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  joined_at       timestamptz not null default now(),
  last_read_at    timestamptz,
  muted           boolean not null default false,
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),  -- client may supply (optimistic UI dedupe)
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid default auth.uid() references public.profiles(id) on delete set null, -- null = system
  kind            public.message_kind not null default 'text',
  body            text not null default '',
  payload         jsonb,               -- event_invite: {event_id, sport_id, starts_at, venue_name}; system: {type, user_id}
  created_at      timestamptz not null default now(),
  constraint messages_body_chk check (char_length(body) <= 2000 and (kind <> 'text' or btrim(body) <> ''))
);
create index messages_conv_created_idx   on public.messages (conversation_id, created_at desc, id desc);
create index messages_sender_created_idx on public.messages (sender_id, created_at desc);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type public.report_target not null,
  target_id   uuid not null,
  reason      public.report_reason not null,
  details     text check (details is null or char_length(details) <= 1000),
  status      public.report_status not null default 'open',
  created_at  timestamptz not null default now(),
  constraint reports_once_uniq unique (reporter_id, target_type, target_id)
);
create index reports_target_idx on public.reports (target_type, target_id);
create index reports_status_idx on public.reports (status, created_at);

create table public.push_tokens (
  token        text primary key check (char_length(token) <= 255),   -- ExponentPushToken[...]
  user_id      uuid not null references public.profiles(id) on delete cascade,
  platform     public.push_platform not null,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

create table public.notifications (           -- in-app inbox + dedupe log + push outbox
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  type          public.notification_type not null,
  payload       jsonb not null default '{}',   -- shapes in §9.2 NotificationPayloads; always contains "url"
  dedupe_key    text,
  push_status   public.push_status not null default 'pending',
  push_attempts smallint not null default 0,
  push_error    text,
  sent_at       timestamptz,
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  constraint notifications_dedupe_uniq unique (user_id, dedupe_key)
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_push_queue_idx   on public.notifications (created_at) where push_status in ('pending','sending');
```

### 3.7 Private helper functions

All are `security definer`, `stable` unless noted, with `set search_path = public, extensions, pg_temp`.

| Function | Returns | Purpose |
|---|---|---|
| `private.is_blocked_pair(p_a uuid, p_b uuid)` | boolean | true if either blocked the other. false if either is null |
| `private.is_conversation_member(p_conversation_id uuid, p_user_id uuid)` | boolean | |
| `private.is_event_member(p_event_id uuid, p_user_id uuid)` | boolean | participant with status in (`going`,`invited`) |
| `private.can_post_message(p_conversation_id uuid, p_user_id uuid)` | boolean | member AND (event conversation OR (match `active` AND the pair isn't blocked)) |
| `private.is_moderator(p_user_id uuid)` | boolean | exists in `private.moderators` |
| `private.district_key_for(p_point geography)` | text | district whose `boundary` covers the point; else nearest `center` within 8 km; else null |
| `private.snap_home_point(p_lat float8, p_lng float8)` | geography | **immutable**. `ST_SetSRID(ST_MakePoint(round(p_lng/0.008)*0.008, round(p_lat/0.005)*0.005),4326)::geography` (~550 m grid) |
| `private.approx_distance_km(p_km float8)` | int | **immutable**. null→null; <1.5→1; <10→round; <30→round to 5; else 30 |
| `private.day_part_of(p_ts timestamptz)` | day_part | Warsaw hour <12 → morning, <17 → afternoon, else evening |
| `private.in_service_area(p_lat float8, p_lng float8)` | boolean | **immutable**. lat ∈ [51.95, 52.50] and lng ∈ [20.70, 21.45] |

```sql
create function private.is_blocked_pair(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select p_a is not null and p_b is not null and exists (
    select 1 from public.blocks b
    where (b.blocker_id = p_a and b.blocked_id = p_b) or (b.blocker_id = p_b and b.blocked_id = p_a));
$$;

create function private.can_post_message(p_conversation_id uuid, p_user_id uuid) returns boolean
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select exists (
    select 1 from public.conversations c
    join public.conversation_members m on m.conversation_id = c.id and m.user_id = p_user_id
    left join public.matches mt on mt.id = c.match_id
    where c.id = p_conversation_id
      and (c.kind = 'event'
           or (mt.status = 'active' and not private.is_blocked_pair(mt.user_a, mt.user_b))));
$$;
```

### 3.8 Triggers

| Trigger (table, timing) | Function | Behaviour |
|---|---|---|
| `on_auth_user_created` (auth.users, AFTER INSERT) | `private.handle_new_user()` | insert `profiles(id)` and `profile_private(user_id)` |
| `*_set_updated_at` (BEFORE UPDATE on profiles, profile_private, venues, events, ratings, runner_profiles) | `private.tg_set_updated_at()` | `new.updated_at = now()` |
| `profiles_avatar_path` (profiles, BEFORE UPDATE OF avatar_path) | `private.tg_profiles_avatar_path()` | raise `invalid_input` unless `avatar_path is null or avatar_path like new.id::text || '/%'` |
| `venues_district` (venues, BEFORE INSERT OR UPDATE OF location) | `private.tg_venues_district()` | `new.district_key := private.district_key_for(new.location)` |
| `events_after_insert` (events, AFTER INSERT) | `private.tg_events_after_insert()` | 1) insert `conversations(kind='event', event_id)`; 2) insert `event_participants(event_id, organizer_id, 'going')` |
| `event_participants_sync` (event_participants, AFTER INSERT OR UPDATE OF status OR DELETE) | `private.tg_event_participants_sync()` | recount `events.spots_taken`; add a conversation member when status=`going`, else remove the member |
| `event_participants_notify` (event_participants, AFTER INSERT OR UPDATE OF status) | `private.tg_event_participants_notify()` | when it becomes `going` and user ≠ organizer: notification `event_joined` to the organizer (dedupe `joined:<event>:<user>`) + system message `{type:'joined', user_id}` in the event chat |
| `ratings_reliability` (ratings, AFTER INSERT OR UPDATE OR DELETE) | `private.tg_ratings_reliability()` | recompute ratee counters/score (SQL below) |
| `messages_rate_limit` (messages, BEFORE INSERT) | `private.tg_messages_rate_limit()` | if `sender_id` is not null and they sent ≥20 messages in the last 60 s → raise `rate_limited` |
| `messages_after_insert` (messages, AFTER INSERT) | `private.tg_messages_after_insert()` | set `conversations.last_message_at`. For `kind='text'`: a `message` notification to every other non-muted, non-blocked member, dedupe `msg:<conversation>:<floor(epoch/300)>` |
| `notifications_dispatch` (notifications, AFTER INSERT, **FOR EACH STATEMENT**, `REFERENCING NEW TABLE AS new_rows`) | `private.tg_notifications_dispatch()` | `net.http_post` to `push-dispatch` with `{notification_ids:[…]}`. No-op if vault secrets are missing (§6) |
| `reports_autohide` (reports, AFTER INSERT) | `private.tg_reports_autohide()` | ≥3 distinct reporters on a `venue_photo` → `venue_photos.status='hidden'`; on a user-created `venue` → `venues.status='hidden'` (OSM venues are never auto-hidden) |

```sql
create function private.tg_event_participants_sync() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_event uuid := coalesce(new.event_id, old.event_id);
  v_user  uuid := coalesce(new.user_id, old.user_id);
  v_conv  uuid;
begin
  update public.events e
     set spots_taken = (select count(*) from public.event_participants p
                         where p.event_id = v_event and p.status = 'going')
   where e.id = v_event;                         -- events_spots_chk makes over-booking impossible
  select c.id into v_conv from public.conversations c where c.event_id = v_event;
  if v_conv is not null then
    if tg_op <> 'DELETE' and new.status = 'going' then
      insert into public.conversation_members (conversation_id, user_id)
      values (v_conv, v_user) on conflict do nothing;
    else
      delete from public.conversation_members where conversation_id = v_conv and user_id = v_user;
    end if;
  end if;
  return null;
end $$;

create function private.tg_ratings_reliability() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_user uuid := coalesce(new.ratee_id, old.ratee_id);
begin
  update public.profiles p
     set attended_count    = s.attended,
         no_show_count     = s.no_show,
         reliability_score = case when s.attended + s.no_show >= 3
                                  then round(100.0 * (s.attended + 2) / (s.attended + s.no_show + 2))::smallint
                             end
    from (select count(*) filter (where r.attended)::int     as attended,
                 count(*) filter (where not r.attended)::int as no_show
            from public.ratings r where r.ratee_id = v_user) s
   where p.id = v_user;
  return null;
end $$;
```

---

## 4. RLS policies & privileges

### 4.1 Principles

1. RLS is **enabled on every table in `public`**. `private.moderators` has no grants at all.
2. The last migration resets privileges: `revoke all on all tables in schema public from anon, authenticated;` and `revoke all on all functions in schema public from public, anon, authenticated;`. It then grants **only** what's listed in §4.3. Supabase's default privileges would otherwise grant everything. Any future migration that adds a table or function must add explicit grants.
3. Policies use `(select auth.uid())` (initPlan caching) and call `private.*` helpers. `grant usage on schema private to anon, authenticated;` and `grant execute` on the 5 boolean helpers in §3.7 to `authenticated`.
4. **Writes go through RPCs** (SECURITY DEFINER). Direct client writes are limited to the column-level grants in §4.3.

### 4.2 Policies (exact)

```sql
-- enable on all: districts, sports, profiles, profile_private, user_sports, availability_slots, runner_profiles, runs,
-- venues, venue_sports, venue_photos, venue_edits, event_series, events, event_participants, ratings, swipes, matches,
-- conversations, conversation_members, messages, blocks, reports, push_tokens, notifications
alter table public.<table> enable row level security;

-- reference data (anon + authenticated)
create policy districts_read    on public.districts    for select to anon, authenticated using (true);
create policy sports_read       on public.sports       for select to anon, authenticated using (true);
create policy venue_sports_read on public.venue_sports for select to anon, authenticated using (true);

-- profiles
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or not private.is_blocked_pair((select auth.uid()), id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- profile_private (owner only)
create policy profile_private_read_own on public.profile_private for select to authenticated
  using (user_id = (select auth.uid()));
create policy profile_private_update_own on public.profile_private for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy user_sports_read on public.user_sports for select to authenticated
  using (user_id = (select auth.uid()) or not private.is_blocked_pair((select auth.uid()), user_id));
create policy availability_read_own on public.availability_slots for select to authenticated
  using (user_id = (select auth.uid()));
create policy runner_profiles_own on public.runner_profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy runs_own on public.runs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- venues
create policy venues_read on public.venues for select to authenticated
  using (status = 'active' or created_by = (select auth.uid()));
create policy venue_photos_read on public.venue_photos for select to authenticated
  using (status = 'active' or uploaded_by = (select auth.uid()));
create policy venue_photos_delete_own on public.venue_photos for delete to authenticated
  using (uploaded_by = (select auth.uid()));
create policy venue_edits_read on public.venue_edits for select to authenticated
  using (created_by = (select auth.uid()) or private.is_moderator((select auth.uid())));

-- events
create policy events_read on public.events for select to authenticated using (
  organizer_id = (select auth.uid())
  or private.is_event_member(id, (select auth.uid()))
  or (visibility = 'public' and not private.is_blocked_pair((select auth.uid()), organizer_id)));
create policy event_series_read on public.event_series for select to authenticated
  using (visibility = 'public' or organizer_id = (select auth.uid()));
create policy event_participants_read_own on public.event_participants for select to authenticated
  using (user_id = (select auth.uid()));           -- lists of others ONLY via event_participants_list()
create policy ratings_read on public.ratings for select to authenticated
  using (rater_id = (select auth.uid()) or ratee_id = (select auth.uid()));

-- matching / chat
create policy swipes_read_own  on public.swipes  for select to authenticated using (swiper_id = (select auth.uid()));
create policy matches_read_own on public.matches for select to authenticated
  using (user_a = (select auth.uid()) or user_b = (select auth.uid()));
create policy conversations_read on public.conversations for select to authenticated
  using (private.is_conversation_member(id, (select auth.uid())));
create policy conversation_members_read on public.conversation_members for select to authenticated using (
  user_id = (select auth.uid())
  or (private.is_conversation_member(conversation_id, (select auth.uid()))
      and not private.is_blocked_pair((select auth.uid()), user_id)));
create policy messages_read on public.messages for select to authenticated using (
  private.is_conversation_member(conversation_id, (select auth.uid()))
  and (sender_id is null or sender_id = (select auth.uid())
       or not private.is_blocked_pair((select auth.uid()), sender_id)));
create policy messages_insert on public.messages for insert to authenticated with check (
  sender_id = (select auth.uid())
  and kind = 'text'
  and payload is null
  and private.can_post_message(conversation_id, (select auth.uid())));

-- safety / notifications
create policy blocks_read_own        on public.blocks        for select to authenticated using (blocker_id = (select auth.uid()));
create policy reports_read_own       on public.reports       for select to authenticated using (reporter_id = (select auth.uid()));
create policy push_tokens_read_own   on public.push_tokens   for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_read_own on public.notifications for select to authenticated using (user_id = (select auth.uid()));
```

### 4.3 Grants (exhaustive)

```sql
grant select on public.districts, public.sports, public.venue_sports to anon, authenticated;
grant select on public.profiles, public.profile_private, public.user_sports, public.availability_slots,
  public.runner_profiles, public.runs, public.venues, public.venue_photos, public.venue_edits,
  public.event_series, public.events, public.event_participants, public.ratings, public.swipes, public.matches,
  public.conversations, public.conversation_members, public.messages, public.blocks, public.reports,
  public.push_tokens, public.notifications to authenticated;

grant update (display_name, avatar_path, bio, district_key, goal, discoverable) on public.profiles to authenticated;
grant update (notify_radius_km, push_enabled, locale)                           on public.profile_private to authenticated;
grant insert (id, conversation_id, body)                                         on public.messages to authenticated;
grant delete                                                                     on public.venue_photos to authenticated;
grant insert, update, delete on public.runner_profiles, public.runs to authenticated;

grant execute on function public.venues_in_bbox, public.venue_detail, public.venue_photos_list,
  public.events_feed, public.event_detail to anon, authenticated;        -- (write full arg lists in SQL)
grant execute on function <every other public RPC in §5 except the two service ones> to authenticated;
grant execute on function public.claim_push_batch, public.complete_push_batch to service_role;
```
`anon` has **no** realtime access (no select on `events`/`messages`/`notifications`). Anonymous feeds poll with `refetchInterval: 30000`.

### 4.4 Never-client-writable columns

| Table.column | Enforcement |
|---|---|
| `profiles.is_verified`, `attended_count`, `no_show_count`, `reliability_score`, `onboarded_at`, `is_mock`, `id`, `created_at` | no column UPDATE grant; set only by triggers/RPCs (`tg_ratings_reliability`, `complete_onboarding`, `set_user_verified`) |
| `profile_private.home_location*` | no column grant; only `set_home_location` / `clear_home_location` |
| `events.*` (all, incl. `spots_taken`, `status`) | no INSERT/UPDATE grant; RPCs + `tg_event_participants_sync` |
| `event_participants`, `ratings`, `swipes`, `matches`, `conversations`, `conversation_members`, `blocks`, `reports`, `push_tokens`, `notifications`, `user_sports`, `availability_slots`, `venues`, `venue_sports`, `venue_edits`, `event_series` | no write grants; RPC only |
| `messages.sender_id`, `kind`, `payload`, `created_at` | INSERT grant only on `(id, conversation_id, body)`; `sender_id` defaults to `auth.uid()` and the policy re-checks it |
| `venue_photos.*` (insert) | RPC `add_venue_photo` only; `status` server-only |

### 4.5 Storage (buckets created in migration)

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',      'avatars',      true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('venue-photos', 'venue-photos', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- avatars: path "<user_id>/<uuid>.jpg"
create policy avatars_select_own on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- venue-photos: path "<venue_id>/<user_id>/<uuid>.jpg"
create policy venue_photos_obj_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'venue-photos'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (select 1 from public.venues v where v.id::text = (storage.foldername(name))[1] and v.status = 'active'));
create policy venue_photos_obj_select_own on storage.objects for select to authenticated
  using (bucket_id = 'venue-photos' and (storage.foldername(name))[2] = (select auth.uid())::text);
create policy venue_photos_obj_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'venue-photos' and (storage.foldername(name))[2] = (select auth.uid())::text);
```
Both buckets are public-read, served via `/storage/v1/object/public/<bucket>/<path>` with random UUID filenames. There's no list policy for others, so they can't be enumerated. Uploads are re-encoded on the client, which strips EXIF/GPS (§2.6 `uploadImage`).

---

## 5. RPC functions (schema `public`, called via `supabase.rpc(name, args)`)

### 5.0 Rules

- Every function is `security definer`, `set search_path = public, extensions, pg_temp`, and starts with `if auth.uid() is null then raise exception 'not_authenticated'` unless it is marked anon-callable.
- Functions with `returns table(...)` written in plpgsql begin with `#variable_conflict use_column` and qualify every column with a table alias.
- **An explicit NULL means "use the default"**: wrap every defaulted argument in `coalesce(p_x, <default>)`.
- A single-row result is still `returns table`. The client takes `data?.[0]`.
- Errors are raised as `raise exception '<code>'`, where `<code>` is one of: `not_authenticated`, `not_found`, `forbidden`, `invalid_input`, `rate_limited`, `profile_incomplete`, `event_full`, `event_not_joinable`, `organizer_cannot_leave`, `not_participant`, `attendance_window_closed`, `outside_service_area`, `duplicate_venue` (`detail` = existing venue id), `match_inactive`.
- **Blocks are reported as `not_found`**, never revealed.
- Rate limits are counted from the table's own `created_at`, over the last 24 h unless stated: `create_event` 10, `add_venue` 5, `suggest_venue_edit` 20, `add_venue_photo` 20, `submit_report` 20, `swipe` 300, `set_home_location` 5/day (counter columns), messages 20/min (trigger).

### 5.1 Venues

| Function | Args | Returns | Access | Behaviour |
|---|---|---|---|---|
| `venues_in_bbox` | `p_min_lng float8, p_min_lat float8, p_max_lng float8, p_max_lat float8, p_sport_ids text[] default null, p_limit int default 400` | `table` → **VenueMapRow** | anon, auth; stable | `status='active'` AND `location && ST_MakeEnvelope(…,4326)::geography` AND (sport filter via `venue_sports`). Ordered by `location <-> bbox centre`. Limit `least(coalesce(p_limit,400),1000)`. `upcoming_events_count` = public scheduled events in the next 7 days. A result length equal to the limit means it was truncated (the client shows "zoom in") |
| `venue_detail` | `p_venue_id uuid` | `table` → **VenueDetailRow** (1 row) | anon, auth | `not_found` unless active or `created_by = uid`. `is_mine`/`has_pending_edit_by_me` are false for anon |
| `venue_photos_list` | `p_venue_id uuid` | `table` → **VenuePhotoRow** | anon, auth | active photos (plus the caller's own), newest first, max 50 |
| `add_venue` | `p_name text, p_kind venue_kind, p_lat float8, p_lng float8, p_sport_ids text[], p_surface text default null, p_is_lit boolean default null, p_is_free boolean default null, p_is_indoor boolean default null, p_opening_hours text default null` | `uuid` | auth | name 1–120 chars; kind ≠ `running_route`; ≥1 valid sport; `in_service_area` else `outside_service_area`. Raises `duplicate_venue` if an active venue within 25 m shares a sport. Inserts venue (`source='user'`, `created_by=uid`) + `venue_sports` + `venue_edits(kind='create', status='approved', proposed=<input>)` |
| `suggest_venue_edit` | `p_venue_id uuid, p_kind venue_edit_kind, p_proposed jsonb, p_comment text default null` | `uuid` | auth | kind must be `update` or `close`. Proposed keys are whitelisted: `name, surface, is_lit, is_free, is_indoor, opening_hours, sport_ids`. Stores a `previous` snapshot with `status='pending'` |
| `add_venue_photo` | `p_venue_id uuid, p_storage_path text` | `uuid` | auth | path must match `^<venue_id>/<uid>/[0-9a-f-]{36}\.(jpg\|jpeg\|png\|webp)$`. Venue must be active |
| `review_venue_edit` | `p_edit_id uuid, p_approve boolean` | `void` | auth + `is_moderator` | approve `update` → apply whitelisted keys, replace `venue_sports` if `sport_ids` given, set `locally_edited_at=now()`. Approve `close` → `venues.status='hidden'`. Sets `reviewed_by`/`reviewed_at`/`status` |

### 5.2 Events

| Function | Args | Returns | Access | Behaviour |
|---|---|---|---|---|
| `events_feed` | `p_lat float8 default null, p_lng float8 default null, p_radius_km float8 default 15, p_sport_ids text[] default null, p_date_range text default 'upcoming', p_district_key text default null, p_venue_id uuid default null, p_only_with_spots boolean default false, p_limit int default 30, p_cursor_starts_at timestamptz default null, p_cursor_id uuid default null` | `table` → **EventCardRow** | anon, auth; stable | public + scheduled events in the date window (below). Radius applies only if lat/lng are given and `p_venue_id` is null. Excludes blocked organizers. Keyset on `(starts_at,id)`. Limit ≤100. **Organizer fields and `my_status` are NULL for anon.** `distance_km` = distance to the venue, rounded to 0.1 |
| `my_events` | `p_scope text default 'upcoming'` (`'upcoming'\|'past'`), `p_limit int default 50` | `table` → **EventCardRow** | auth | events where the caller is organizer or a participant with status `going`/`invited`, any status. Upcoming: `ends_at >= now()` ascending; past: descending |
| `event_detail` | `p_event_id uuid` | `table` → **EventDetailRow** (1 row) | anon, auth | visibility as in `events_read`; anon sees public only, otherwise `not_found`. `conversation_id` only if the caller is `going`. `can_join` = scheduled AND `starts_at > now()` AND `spots_left > 0` AND caller isn't going/organizer (computed without auth for anon). `attendance_open` = caller is organizer AND status ≠ cancelled AND `now()` between `starts_at` and `ends_at + 72h` |
| `event_participants_list` | `p_event_id uuid` | `table` → **ParticipantRow** | auth | event must be visible to the caller. Returns `going` participants (+ `invited` if the caller is the organizer), excluding users in a blocked pair with the caller. `attended` is filled only for the organizer (from `ratings`) |
| `create_event` | `p_sport_id text, p_venue_id uuid, p_starts_at timestamptz, p_duration_min int default null, p_spots_total int default null, p_spots_reserved int default 0, p_level int default null, p_title text default null, p_description text default null, p_repeat_weekdays int[] default null, p_repeat_until date default null` | `table(event_id uuid, series_id uuid, conversation_id uuid)` → **CreateEventResult** | auth | Requires `onboarded_at` (else `profile_incomplete`). `starts_at` ∈ (now, now + 60 days]; duration default `sports.default_duration_min`; spots default `sports.default_spots`; `0 <= reserved <= total-2`; level null or 1–5; venue active; rate limit. **Single event:** insert `events` (the trigger creates the chat and organizer participant). **Recurring** (`p_repeat_weekdays` not null): weekdays ⊆ 1..7; `until` ≤ starts_on + 26 weeks (default + 8 weeks); insert `event_series` (start_time/starts_on derived from `p_starts_at` in Warsaw time); `private.materialize_series(id)`; return the first occurrence ≥ `p_starts_at` |
| `join_event` | `p_event_id uuid` | `table(spots_taken int, spots_total int, spots_reserved int, conversation_id uuid)` → **JoinEventResult** | auth | atomic; SQL below. Idempotent if already going. Turns `invited` → `going` |
| `leave_event` | `p_event_id uuid` | `void` | auth | organizer → `organizer_cannot_leave`; must be `going` (else `not_participant`); `starts_at > now()` (else `event_not_joinable`); status → `left`, `left_at=now()` |
| `decline_invite` | `p_event_id uuid` | `void` | auth | `invited` → `left` |
| `cancel_event` | `p_event_id uuid, p_reason text default null` | `void` | auth, organizer | scheduled and not yet ended → `status='cancelled'`, `cancelled_at`, `cancel_reason`. Notification `event_cancelled` to all `going` except organizer (dedupe `cancel:<id>`). System message `{type:'cancelled'}` |
| `remove_participant` | `p_event_id uuid, p_user_id uuid` | `void` | auth, organizer | cannot remove self; status → `removed` (frees the spot; the user can't rejoin) |
| `cancel_series` | `p_series_id uuid` | `void` | auth, organizer | `is_active=false`; cancels future scheduled occurrences (same side effects as `cancel_event`) |
| `submit_attendance` | `p_event_id uuid, p_marks jsonb` (`[{"user_id":uuid,"attended":bool}]`) | `void` | auth, organizer | window `[starts_at, ends_at+72h]` else `attendance_window_closed`. Each user must be a `going` participant ≠ organizer (else `not_participant`). Upserts `ratings(event_id, ratee_id, rater_id=uid, attended)`; the trigger recomputes reliability |

**Feed date windows** (`v_today := (now() at time zone 'Europe/Warsaw')::date`, `v_dow := extract(isodow from v_today)`; `X::timestamp at time zone 'Europe/Warsaw'` converts a local date to timestamptz):

| `p_date_range` | from | to |
|---|---|---|
| `today` | `now()` | `v_today + 1` |
| `tomorrow` | `v_today + 1` | `v_today + 2` |
| `weekend` | if `v_dow >= 6` then `now()` else `v_today + (6 - v_dow)` | `v_today + (8 - v_dow)` (Monday 00:00) |
| `week` | `now()` | `now() + 7 days` |
| `upcoming` | `now()` | `now() + 60 days` |
| other | raise `invalid_input` | |

```sql
create or replace function public.join_event(p_event_id uuid)
returns table (spots_taken int, spots_total int, spots_reserved int, conversation_id uuid)
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare
  v_uid    uuid := auth.uid();
  v_ev     public.events%rowtype;
  v_status public.participant_status;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_ev from public.events e where e.id = p_event_id for update;   -- serialises joins per event
  if not found or private.is_blocked_pair(v_uid, v_ev.organizer_id) then raise exception 'not_found'; end if;

  select ep.status into v_status from public.event_participants ep
   where ep.event_id = p_event_id and ep.user_id = v_uid;

  if v_ev.visibility = 'private' and v_status is null then raise exception 'not_found'; end if;
  if v_status = 'removed' then raise exception 'forbidden'; end if;
  if v_ev.status <> 'scheduled' or v_ev.starts_at <= now() then raise exception 'event_not_joinable'; end if;

  if v_status is distinct from 'going' then
    if v_ev.spots_taken + v_ev.spots_reserved >= v_ev.spots_total then raise exception 'event_full'; end if;
    insert into public.event_participants (event_id, user_id, status, joined_at)
    values (p_event_id, v_uid, 'going', now())
    on conflict (event_id, user_id) do update set status = 'going', joined_at = now(), left_at = null;
    -- triggers: spots_taken recount (same tx, row already locked), chat membership, organizer notification
  end if;

  return query
    select e.spots_taken::int, e.spots_total::int, e.spots_reserved::int, c.id
      from public.events e left join public.conversations c on c.event_id = e.id
     where e.id = p_event_id;
end $$;
```

**Recurring materialisation** (`private.materialize_series(p_series_id uuid, p_horizon_days int default 14) returns int`; `private.materialize_all_series() returns int` loops over active series):
```sql
insert into public.events (series_id, sport_id, venue_id, organizer_id, title, description,
                           starts_at, ends_at, spots_total, spots_reserved, level, visibility, is_mock)
select s.id, s.sport_id, s.venue_id, s.organizer_id, s.title, s.description,
       x.starts_at, x.starts_at + make_interval(mins => s.duration_min),
       s.spots_total, s.spots_reserved, s.level, s.visibility, s.is_mock
from public.event_series s
cross join lateral (
  select ((d::date + s.start_time) at time zone s.timezone) as starts_at
  from generate_series(
         greatest(s.starts_on, (now() at time zone s.timezone)::date)::timestamp,
         least(coalesce(s.until_on, 'infinity'::date), (now() at time zone s.timezone)::date + p_horizon_days)::timestamp,
         interval '1 day') as d
  where extract(isodow from d)::int = any (s.weekdays)
) x
where s.id = p_series_id and s.is_active and x.starts_at > now()
on conflict (series_id, starts_at) do nothing;      -- idempotent; events_after_insert creates chat + organizer row
```

### 5.3 Chats

| Function | Args | Returns | Behaviour |
|---|---|---|---|
| `get_or_create_event_conversation` | `p_event_id uuid` | `uuid` | caller must be a `going` participant (else `not_participant`). Creates the conversation if missing (legacy/mock rows), ensures membership |
| `my_conversations` | — | `table` → **ConversationListRow** | conversations where the caller is a member. Excludes match conversations whose match isn't `active` or whose pair is blocked. `title` = event title for event chats (null → client composes sport + time), other user's `display_name` for match chats. `unread_count` = messages after `last_read_at` not sent by the caller. Ordered by `coalesce(last_message_at, created_at) desc` |
| `mark_conversation_read` | `p_conversation_id uuid` | `void` | `last_read_at = now()` for the caller's membership |
| `set_conversation_muted` | `p_conversation_id uuid, p_muted boolean` | `void` | |

Message reading and sending are direct table operations (RLS §4.2):
- Read: `from('messages').select('id,conversation_id,sender_id,kind,body,payload,created_at').eq('conversation_id',id).order('created_at',{ascending:false}).limit(50)`, keyset with `.lt('created_at', cursor)`.
- Send: `from('messages').insert({ id: Crypto.randomUUID(), conversation_id, body })`.
- Members: `from('conversation_members').select('user_id,last_read_at,profiles(display_name,avatar_path,is_verified)').eq('conversation_id',id)`.

### 5.4 Matching & people

| Function | Args | Returns | Behaviour |
|---|---|---|---|
| `match_candidates` | `p_limit int default 20, p_sport_id text default null` | `table` → **CandidateRow** | scoring below. Caller must be onboarded with ≥1 sport (else `profile_incomplete`). Limit ≤50 |
| `swipe` | `p_target_id uuid, p_liked boolean, p_sport_id text default null` | `table(match_id uuid, conversation_id uuid)` → **SwipeResult** (nulls if no match) | target ≠ self, onboarded and discoverable, not blocked (else `not_found`); rate limit. `pg_advisory_xact_lock(hashtextextended(least(a,b)::text \|\| greatest(a,b)::text, 0))`; upsert into `swipes`. If liked and the reverse like exists: insert `matches(least, greatest)` on conflict do nothing; conversation `kind='match'` + 2 members; notification `match` to **both** (dedupe `match:<id>`) |
| `unmatch` | `p_match_id uuid` | `void` | participant of the match → `status='unmatched'`, `unmatched_at`, delete both `conversation_members` rows |
| `propose_meeting` | `p_match_id uuid, p_sport_id text, p_venue_id uuid, p_starts_at timestamptz, p_duration_min int default null, p_note text default null` | `table(event_id uuid, conversation_id uuid)` → **ProposeMeetingResult** | match active and not blocked (else `match_inactive`). Creates a **private** event (`spots_total=2`, `spots_reserved=0`, organizer = caller). Inserts the other user as `event_participants.status='invited'`. Message in the **match** conversation: `kind='event_invite'`, `sender_id=uid`, `body=coalesce(p_note,'')`, `payload={event_id, sport_id, starts_at, venue_name}`. Notification `event_invite`. Returns the match conversation id. The invitee accepts via `join_event` or declines via `decline_invite` |
| `person_summary` | `p_user_id uuid` | `table` → **PersonSummaryRow** (1 row) | `not_found` if blocked or missing. `distance_km_approx` only if both home locations exist. Includes active `match_id`/`conversation_id` between the caller and the target |

**Scoring formula** (mirrored in `packages/shared/src/scoring.ts` with identical constants):
- Sport overlap `S = |A∩B| / |A∪B|` (Jaccard over sport ids).
- Level closeness `L = mean over common sports of (1 − |ℓa − ℓb| / 4)`.
- Schedule overlap `T = |SA∩SB| / min(|SA|,|SB|)` over (weekday, day_part) slots; `0.5` if either side has no slots.
- Distance `D = exp(−d/5)` with d in km. If either home location is missing: same district → `D = exp(−3/5)`; otherwise `D = 0.3`.
- **score = (0.25+0.75·S)·(0.25+0.75·L)·(0.4+0.6·T)·(0.2+0.8·D)** ∈ (0,1].
- Pool filters: not self, onboarded, discoverable, no blocked pair, not liked by the caller ever, not passed by the caller in the last 14 days, no existing match (any status), ≥1 common sport (and plays `p_sport_id` if given), within 30 km when both locations exist.
- Order: score desc, then id.

```sql
create or replace function public.match_candidates(p_limit int default 20, p_sport_id text default null)
returns table (user_id uuid, display_name text, avatar_path text, bio text, district_key text,
  goal public.user_goal, is_verified boolean, reliability_score smallint,
  sport_ids text[], sport_levels smallint[], common_sport_ids text[], distance_km_approx int,
  score real, score_sport real, score_level real, score_schedule real, score_distance real)
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid(); v_home extensions.geography; v_district text; v_my_sports int; v_my_slots int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select p.district_key, pp.home_location into v_district, v_home
    from public.profiles p join public.profile_private pp on pp.user_id = p.id
   where p.id = v_uid and p.onboarded_at is not null;
  if not found then raise exception 'profile_incomplete'; end if;
  select count(*) into v_my_sports from public.user_sports us where us.user_id = v_uid;
  if v_my_sports = 0 then raise exception 'profile_incomplete'; end if;
  select count(*) into v_my_slots from public.availability_slots a where a.user_id = v_uid;

  return query
  with my_sports as (select us.sport_id, us.level from public.user_sports us where us.user_id = v_uid),
  pool as (
    select p.id, p.display_name, p.avatar_path, p.bio, p.district_key, p.goal, p.is_verified,
           p.reliability_score, pp.home_location
    from public.profiles p join public.profile_private pp on pp.user_id = p.id
    where p.id <> v_uid and p.onboarded_at is not null and p.discoverable
      and not private.is_blocked_pair(v_uid, p.id)
      and not exists (select 1 from public.swipes s where s.swiper_id = v_uid and s.target_id = p.id
                        and (s.liked or s.created_at > now() - interval '14 days'))
      and not exists (select 1 from public.matches m
                       where m.user_a = least(v_uid, p.id) and m.user_b = greatest(v_uid, p.id))
      and exists (select 1 from public.user_sports us join my_sports ms on ms.sport_id = us.sport_id
                   where us.user_id = p.id and (p_sport_id is null or us.sport_id = p_sport_id))
      and (v_home is null or pp.home_location is null or st_dwithin(v_home, pp.home_location, 30000))
  ),
  theirs as (
    select us.user_id, array_agg(us.sport_id order by us.sport_id) as sport_ids,
           array_agg(us.level order by us.sport_id) as sport_levels, count(*)::int as n
    from public.user_sports us where us.user_id in (select id from pool) group by us.user_id),
  common as (
    select us.user_id, array_agg(us.sport_id order by us.sport_id) as common_ids, count(*)::int as n,
           avg(1.0 - abs(us.level - ms.level) / 4.0)::real as level_close
    from public.user_sports us join my_sports ms on ms.sport_id = us.sport_id
    where us.user_id in (select id from pool) group by us.user_id),
  sched as (
    select a.user_id, count(*)::int as n,
           count(*) filter (where exists (select 1 from public.availability_slots m
               where m.user_id = v_uid and m.weekday = a.weekday and m.day_part = a.day_part))::int as overlap_n
    from public.availability_slots a where a.user_id in (select id from pool) group by a.user_id),
  comp as (
    select p.*, t.sport_ids, t.sport_levels, c.common_ids,
      (c.n::real / (t.n + v_my_sports - c.n))::real as s_sport,
      c.level_close as s_level,
      (case when coalesce(sc.n,0) = 0 or v_my_slots = 0 then 0.5
            else sc.overlap_n::real / least(sc.n, v_my_slots) end)::real as s_sched,
      case when v_home is not null and p.home_location is not null
           then st_distance(v_home, p.home_location) / 1000.0 end as d_km
    from pool p join theirs t on t.user_id = p.id join common c on c.user_id = p.id
    left join sched sc on sc.user_id = p.id),
  comp2 as (
    select comp.*, (case when comp.d_km is not null then exp(-comp.d_km / 5.0)
                         when v_district is not null and comp.district_key = v_district then exp(-3.0 / 5.0)
                         else 0.3 end)::real as s_dist
    from comp)
  select c2.id, c2.display_name, c2.avatar_path, c2.bio, c2.district_key, c2.goal, c2.is_verified,
         c2.reliability_score, c2.sport_ids, c2.sport_levels, c2.common_ids,
         private.approx_distance_km(c2.d_km),                         -- precise distance never leaves the DB
         ((0.25 + 0.75*c2.s_sport) * (0.25 + 0.75*c2.s_level) * (0.4 + 0.6*c2.s_sched) * (0.2 + 0.8*c2.s_dist))::real,
         c2.s_sport, c2.s_level, c2.s_sched, c2.s_dist
  from comp2 c2
  order by 13 desc, c2.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
end $$;
```

### 5.5 Profile

| Function | Args | Returns | Behaviour |
|---|---|---|---|
| `complete_onboarding` | — | `void` | requires `btrim(display_name)` ≥ 2 chars and ≥1 `user_sports` row (else `profile_incomplete`); `onboarded_at = coalesce(onboarded_at, now())` |
| `set_user_sports` | `p_sports jsonb` (`[{"sport_id":text,"level":1..5}]`, ≤9, unique) | `void` | validate, then delete + insert the caller's rows in one tx |
| `set_availability` | `p_slots jsonb` (`[{"weekday":1..7,"day_part":"morning"\|"afternoon"\|"evening"}]`, ≤21) | `void` | replace all |
| `set_home_location` | `p_lat float8, p_lng float8` | `table(district_key text)` → **HomeLocationResult** | `in_service_area` else `outside_service_area`; rate limit 5/day (counter columns); store `private.snap_home_point()`; detected district = `district_key_for(snapped)`; set `profiles.district_key` only if currently null. Returns the detected district |
| `clear_home_location` | — | `void` | null the location columns |
| `set_user_verified` | `p_user_id uuid, p_verified boolean` | `void` | moderator only. MVP verification is manual |
| `moderate_content` | `p_target_type report_target, p_target_id uuid, p_status moderation_status` | `void` | moderator only; applies to `venue`/`venue_photo` |

Direct writes allowed: `profiles` (granted columns), `profile_private` (`notify_radius_km`, `push_enabled`, `locale`), `runner_profiles`, `runs`.

### 5.6 Safety & notifications

| Function | Args | Returns | Behaviour |
|---|---|---|---|
| `block_user` | `p_user_id uuid` | `void` | insert `blocks` (idempotent); set any active match between the pair to `unmatched` + remove its members; set pending `invited` rows between them to `left` |
| `unblock_user` | `p_user_id uuid` | `void` | delete the row |
| `blocked_users` | — | `table` → **BlockedUserRow** | the caller's blocks with names (DEFINER, because `profiles_read` hides blocked users) |
| `submit_report` | `p_target_type report_target, p_target_id uuid, p_reason report_reason, p_details text default null` | `uuid` | rate limit; `on conflict (reporter_id,target_type,target_id) do update set reason, details`. Autohide trigger |
| `register_push_token` | `p_token text, p_platform push_platform` | `void` | token must match `^Expo(nent)?PushToken\[.+\]$`; upsert by token with `user_id = uid` (re-assigns devices across accounts), `last_seen_at=now()` |
| `unregister_push_token` | `p_token text` | `void` | delete where token = p_token and user_id = uid |
| `mark_notifications_read` | `p_ids uuid[] default null` | `void` | null → all unread of the caller |
| `claim_push_batch` | `p_ids uuid[] default null, p_limit int default 100` | `table(notification_id uuid, user_id uuid, type notification_type, payload jsonb, locale text, tokens text[])` → **PushClaimRow** | **service_role only.** Selects `pending` rows (ids given → those ids; else older than 20 s, or `sending` older than 5 min with attempts < 3) `for update skip locked`. Users with `push_enabled=false` or no tokens → `skipped` and not returned. Others → `sending`, attempts+1 |
| `complete_push_batch` | `p_results jsonb` (`[{"notification_id":uuid,"status":"sent"\|"failed","error":text?}]`), `p_invalid_tokens text[] default '{}'` | `void` | **service_role only.** Sets status / `sent_at` / `push_error` (failed with attempts < 3 → back to `pending`); deletes invalid tokens |

### 5.7 Private cron functions

| Function | Schedule (pg_cron, UTC) | Behaviour |
|---|---|---|
| `private.complete_past_events()` | `5 * * * *` | scheduled and `ends_at < now()` → `completed`; notification `attendance_reminder` to the organizer when ≥2 participants were going (dedupe `attend:<id>`) |
| `private.materialize_all_series()` | `0 2 * * *` | 14-day horizon for every active series |
| `private.enqueue_nearby_event_notifications()` | `*/15 * * * *` | SQL below |
| `private.dispatch_pending_push()` | `* * * * *` | if pending/stale rows exist and vault secrets exist → `net.http_post` to `push-dispatch` with `{}` (sweep/retry) |
| `private.cleanup()` | `30 3 * * *` | delete notifications > 90 days; reset `home_location_changes_*` older than today |

```sql
-- "Football nearby in 2 hours, 1 person missing"
insert into public.notifications (user_id, type, payload, dedupe_key)
select pp.user_id, 'event_nearby',
       jsonb_build_object('event_id', e.id, 'sport_id', e.sport_id, 'venue_name', v.name, 'venue_kind', v.kind,
                          'starts_at', e.starts_at, 'spots_left', e.spots_total - e.spots_taken - e.spots_reserved,
                          'url', '/event/' || e.id),
       'nearby:' || e.id
from public.events e
join public.venues v           on v.id = e.venue_id
join public.profile_private pp on pp.push_enabled and pp.home_location is not null
                              and st_dwithin(pp.home_location, v.location, pp.notify_radius_km * 1000)
join public.profiles pr        on pr.id = pp.user_id and pr.onboarded_at is not null
join public.user_sports us     on us.user_id = pp.user_id and us.sport_id = e.sport_id
                              and (e.level is null or abs(us.level - e.level) <= 1)
where e.status = 'scheduled' and e.visibility = 'public'
  and e.starts_at >= now() + interval '105 minutes' and e.starts_at < now() + interval '135 minutes'
  and e.spots_taken + e.spots_reserved < e.spots_total
  and pp.user_id <> e.organizer_id
  and not exists (select 1 from public.event_participants ep where ep.event_id = e.id and ep.user_id = pp.user_id)
  and not private.is_blocked_pair(pp.user_id, e.organizer_id)
  and (select count(*) from public.notifications n where n.user_id = pp.user_id
         and n.type = 'event_nearby' and n.created_at > now() - interval '24 hours') < 3
  and (not exists (select 1 from public.availability_slots a where a.user_id = pp.user_id)
       or exists (select 1 from public.availability_slots a where a.user_id = pp.user_id
                    and a.weekday = extract(isodow from e.starts_at at time zone 'Europe/Warsaw')::int
                    and a.day_part = private.day_part_of(e.starts_at)))
on conflict (user_id, dedupe_key) do nothing;
```

---

## 6. Edge Functions (Deno, `supabase/functions/*`)

Only two functions are needed. Everything else is SQL plus pg_cron (§5.7).

| Function | Trigger | Input → output | Env |
|---|---|---|---|
| **`push-dispatch`** (`verify_jwt = false`) | (1) the statement-level trigger `notifications_dispatch` via `pg_net`; (2) cron `bojo-push-sweep` every minute via `private.dispatch_pending_push()` | Header `x-bojo-dispatch-secret` must equal `PUSH_DISPATCH_SECRET` (else 401). Body `{ notification_ids?: string[] }`. Steps: service-role client → `claim_push_batch` → build Expo messages per token `{to, title, body, data:{url, notification_id, type}, sound:'default', channelId:'default'}` with localised text from `templates.ts` (ru/pl/en × `notification_type`, using `locale` + payload; includes a sport-name dictionary) → POST in chunks of 100 to `https://exp.host/--/api/v2/push/send` (Bearer `EXPO_ACCESS_TOKEN` if set) → a ticket `ok` means sent; `DeviceNotRegistered` means an invalid token → `complete_push_batch`. Response `{claimed, sent, failed, invalid_tokens}`. **Message bodies are never included in push** (only the sender name). | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (auto-injected), `PUSH_DISPATCH_SECRET`, `EXPO_ACCESS_TOKEN` (optional) |
| **`delete-account`** (`verify_jwt = true`) | client: `supabase.functions.invoke('delete-account')` from settings (d) | Gets the user from the JWT → removes storage `avatars/<uid>/*` → `auth.admin.deleteUser(uid)` (cascades all `public` rows; `venue_photos.uploaded_by` / `venues.created_by` become null). Returns `{ok:true}`. CORS from `_shared/cors.ts` | auto-injected only |

**pg_net/Vault wiring** (in a migration):
```sql
create function private.tg_notifications_dispatch() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'bojo_functions_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'bojo_dispatch_secret';
  if v_url is null or v_secret is null then return null; end if;          -- graceful: in-app inbox still works
  perform net.http_post(
    url     := v_url || '/push-dispatch',
    body    := jsonb_build_object('notification_ids', (select jsonb_agg(id) from new_rows)),
    headers := jsonb_build_object('Content-Type','application/json','x-bojo-dispatch-secret', v_secret));
  return null;
end $$;
create trigger notifications_dispatch after insert on public.notifications
  referencing new table as new_rows for each statement execute function private.tg_notifications_dispatch();
```
Cron jobs are created with `select cron.schedule('<name>', '<cron>', $$select private.<fn>()$$);` under the names `bojo-complete-events`, `bojo-materialize-series`, `bojo-nearby-events`, `bojo-push-sweep` and `bojo-cleanup`.

Local secrets live in `supabase/seeds/00_local_vault.sql`:
- `vault.create_secret('http://host.docker.internal:44321/functions/v1','bojo_functions_url')`
- `vault.create_secret('local-dev-dispatch-secret','bojo_dispatch_secret')`

These are dev placeholders, not real keys. Production sets real values once in the SQL editor.

**Client push behaviour** (c, `features/notifications/push.ts`). Registration returns `null` and is skipped silently when:
- the platform is web;
- the app runs in Expo Go on Android (`Constants.executionEnvironment === 'storeClient' && Platform.OS === 'android'`);
- `!Device.isDevice`;
- no `projectId` is available;
- permission is denied.

Import `expo-notifications` lazily (`await import(...)`) inside the guard. When a token is obtained: `register_push_token`, then save it to `AsyncStorage[STORAGE_KEYS.pushToken]`. Notification taps go to `router.push(data.url)`. In every environment, `NotificationsBridge` subscribes to Realtime `notifications` for an in-app toast and the inbox badge.

---

## 7. Realtime design

- Publication: `alter publication supabase_realtime add table public.messages, public.events, public.notifications;`. No other tables. `profile_private` is never published.
- Transport: `postgres_changes`. Realtime evaluates the subscriber's **SELECT RLS** per change, so the policies in §4.2 decide delivery: chat membership, blocked senders filtered, events visibility, own notifications only. supabase-js forwards the session JWT automatically. Anonymous users don't subscribe; they poll.

| Channel name | Subscription | Client action |
|---|---|---|
| `conversation:<id>` | `{event:'INSERT', schema:'public', table:'messages', filter:'conversation_id=eq.<id>'}` | append to the `qk.messages(id)` cache; dedupe by `id` (client-generated uuid for own messages); `mark_conversation_read` when the screen is focused |
| `event:<id>` | `{event:'UPDATE', table:'events', filter:'id=eq.<id>'}` | patch `qk.event(id)` with `spots_taken/spots_reserved/spots_total/status`; invalidate `qk.eventParticipants(id)` |
| `events-feed:<hash>` | `{event:'UPDATE', table:'events', filter:'id=in.(<≤100 visible ids>)'}` | patch matching rows in the feed caches (live spots counter) |
| `notifications:<uid>` | `{event:'INSERT', table:'notifications', filter:'user_id=eq.<uid>'}` | toast + invalidate `qk.notifications`; for `type='message'` or `'match'`, invalidate `qk.conversations` |

Unsubscribe on unmount and resubscribe when the AppState returns to active.

---

## 8. Location privacy model

1. **Precise user coordinates are never stored.** The only stored user location is `profile_private.home_location`. It is written **only** by `set_home_location`, which snaps it server-side to a ~550 m grid (`0.005°` lat × `0.008°` lng) before any write. Changes are limited to 5 per day, which limits trilateration by moving one's own point.
2. **Read access:** `profile_private` has owner-only RLS; it isn't in the Realtime publication and `anon` has no grant. No view and no RPC returns another user's `home_location` or coordinates.
3. **Cross-user exposure is derived only, inside SECURITY DEFINER functions** (`match_candidates`, `person_summary`):
   - `distance_km_approx` ∈ {1 (shown "≤1 km"), 2…9, 10, 15, 20, 25, 30 (shown "30+ km")} via `private.approx_distance_km`;
   - `district_key`, which the user chose or the server derived.
   - Grid snapping (~0.55 km) combined with bucketing (≥1 km) keeps trilateration error at about 1 km or more.
4. **Device location** (GPS) is used client-side for map centring. It's sent only as `events_feed(p_lat, p_lng)`, rounded on the client to 3 decimals (~100 m), and never persisted or logged by our code. `p_lat/p_lng` affect only filtering and sorting, plus the distance **to public venues**.
5. **Venue coordinates are public** (public places, OSM). Event cards expose venue location, never participant locations.
6. **Nearby-event notifications** are computed server-side with `ST_DWithin`. The payload contains only event and venue data.
7. **Photos** are re-encoded before upload, which strips EXIF GPS. Run routes (stub) are owner-only. Any future sharing must trim the first and last 500 m.
8. **Anonymous users** see no profile, participant or organizer identity: RPCs return NULL for those fields, and anon has no table grants.

---

## 9. Shared TypeScript contract (`packages/shared/src`) — owner (a)

Client code imports **only** from `@bojo/shared` (the barrel `index.ts`).

### 9.1 `database.types.ts`

Hand-written now in the exact format produced by `supabase gen types typescript`. Once migrations run, it is replaced by `npm run db:types`.

```ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type Database = {
  public: {
    Tables: {
      events: {
        Row: { id: string; series_id: string | null; sport_id: string; venue_id: string; organizer_id: string;
               title: string | null; description: string | null; starts_at: string; ends_at: string;
               spots_total: number; spots_taken: number; spots_reserved: number; level: number | null;
               visibility: Database['public']['Enums']['event_visibility'];
               status: Database['public']['Enums']['event_status'];
               cancelled_at: string | null; cancel_reason: string | null; is_mock: boolean;
               created_at: string; updated_at: string };
        Insert: { /* same keys; optional (?) where the column has a default or is nullable */ };
        Update: { /* all keys optional */ };
        Relationships: [ { foreignKeyName: 'events_venue_id_fkey'; columns: ['venue_id']; isOneToOne: false;
                           referencedRelation: 'venues'; referencedColumns: ['id'] }, /* … every FK */ ];
      };
      /* …every table in §3 */
    };
    Views: { [_ in never]: never };
    Functions: { /* exactly as listed below */ };
    Enums: { venue_kind: 'pitch' | 'sports_centre' | /* … all enums in §3.1 */ };
    CompositeTypes: { [_ in never]: never };
  };
};
```

Type mapping:

| Postgres | TypeScript |
|---|---|
| uuid / text / timestamptz / date / time | `string` |
| smallint / int / numeric / float8 / real | `number` |
| boolean | `boolean` |
| jsonb | `Json` |
| geography | `unknown` |
| arrays | `T[]` |
| function `void` | `undefined` |

Write `Relationships` for every FK so embedded selects type-check (e.g. `conversation_members → profiles`).

`Functions` (Args → Returns; row types from `rpc.types.ts`; `?` = has a default):
```ts
venues_in_bbox:   { Args: { p_min_lng: number; p_min_lat: number; p_max_lng: number; p_max_lat: number; p_sport_ids?: string[]; p_limit?: number }; Returns: VenueMapRow[] };
venue_detail:     { Args: { p_venue_id: string }; Returns: VenueDetailRow[] };
venue_photos_list:{ Args: { p_venue_id: string }; Returns: VenuePhotoRow[] };
add_venue:        { Args: { p_name: string; p_kind: VenueKind; p_lat: number; p_lng: number; p_sport_ids: string[]; p_surface?: string; p_is_lit?: boolean; p_is_free?: boolean; p_is_indoor?: boolean; p_opening_hours?: string }; Returns: string };
suggest_venue_edit:{ Args: { p_venue_id: string; p_kind: VenueEditKind; p_proposed: Json; p_comment?: string }; Returns: string };
add_venue_photo:  { Args: { p_venue_id: string; p_storage_path: string }; Returns: string };
review_venue_edit:{ Args: { p_edit_id: string; p_approve: boolean }; Returns: undefined };
events_feed:      { Args: { p_lat?: number; p_lng?: number; p_radius_km?: number; p_sport_ids?: string[]; p_date_range?: string; p_district_key?: string; p_venue_id?: string; p_only_with_spots?: boolean; p_limit?: number; p_cursor_starts_at?: string; p_cursor_id?: string }; Returns: EventCardRow[] };
my_events:        { Args: { p_scope?: string; p_limit?: number }; Returns: EventCardRow[] };
event_detail:     { Args: { p_event_id: string }; Returns: EventDetailRow[] };
event_participants_list: { Args: { p_event_id: string }; Returns: ParticipantRow[] };
create_event:     { Args: { p_sport_id: string; p_venue_id: string; p_starts_at: string; p_duration_min?: number; p_spots_total?: number; p_spots_reserved?: number; p_level?: number; p_title?: string; p_description?: string; p_repeat_weekdays?: number[]; p_repeat_until?: string }; Returns: CreateEventResult[] };
join_event:       { Args: { p_event_id: string }; Returns: JoinEventResult[] };
leave_event:      { Args: { p_event_id: string }; Returns: undefined };
decline_invite:   { Args: { p_event_id: string }; Returns: undefined };
cancel_event:     { Args: { p_event_id: string; p_reason?: string }; Returns: undefined };
remove_participant:{ Args: { p_event_id: string; p_user_id: string }; Returns: undefined };
cancel_series:    { Args: { p_series_id: string }; Returns: undefined };
submit_attendance:{ Args: { p_event_id: string; p_marks: Json }; Returns: undefined };
get_or_create_event_conversation: { Args: { p_event_id: string }; Returns: string };
my_conversations: { Args: Record<PropertyKey, never>; Returns: ConversationListRow[] };
mark_conversation_read: { Args: { p_conversation_id: string }; Returns: undefined };
set_conversation_muted: { Args: { p_conversation_id: string; p_muted: boolean }; Returns: undefined };
match_candidates: { Args: { p_limit?: number; p_sport_id?: string }; Returns: CandidateRow[] };
swipe:            { Args: { p_target_id: string; p_liked: boolean; p_sport_id?: string }; Returns: SwipeResult[] };
unmatch:          { Args: { p_match_id: string }; Returns: undefined };
propose_meeting:  { Args: { p_match_id: string; p_sport_id: string; p_venue_id: string; p_starts_at: string; p_duration_min?: number; p_note?: string }; Returns: ProposeMeetingResult[] };
person_summary:   { Args: { p_user_id: string }; Returns: PersonSummaryRow[] };
complete_onboarding: { Args: Record<PropertyKey, never>; Returns: undefined };
set_user_sports:  { Args: { p_sports: Json }; Returns: undefined };
set_availability: { Args: { p_slots: Json }; Returns: undefined };
set_home_location:{ Args: { p_lat: number; p_lng: number }; Returns: HomeLocationResult[] };
clear_home_location: { Args: Record<PropertyKey, never>; Returns: undefined };
block_user:       { Args: { p_user_id: string }; Returns: undefined };
unblock_user:     { Args: { p_user_id: string }; Returns: undefined };
blocked_users:    { Args: Record<PropertyKey, never>; Returns: BlockedUserRow[] };
submit_report:    { Args: { p_target_type: ReportTarget; p_target_id: string; p_reason: ReportReason; p_details?: string }; Returns: string };
register_push_token:   { Args: { p_token: string; p_platform: PushPlatform }; Returns: undefined };
unregister_push_token: { Args: { p_token: string }; Returns: undefined };
mark_notifications_read: { Args: { p_ids?: string[] }; Returns: undefined };
set_user_verified:{ Args: { p_user_id: string; p_verified: boolean }; Returns: undefined };
moderate_content: { Args: { p_target_type: ReportTarget; p_target_id: string; p_status: ModerationStatus }; Returns: undefined };
claim_push_batch: { Args: { p_ids?: string[]; p_limit?: number }; Returns: PushClaimRow[] };
complete_push_batch: { Args: { p_results: Json; p_invalid_tokens?: string[] }; Returns: undefined };
```

### 9.2 `rpc.types.ts` (hand-written, never generated; the client-facing source of truth)

Generated types lose nullability on function outputs. Assigning generated results to these interfaces still type-checks.

```ts
export interface BBox { minLng: number; minLat: number; maxLng: number; maxLat: number }
export type EventDateRange = 'today' | 'tomorrow' | 'weekend' | 'week' | 'upcoming';
export interface EventsFeedParams { lat?: number; lng?: number; radiusKm?: number; sportIds?: string[];
  dateRange?: EventDateRange; districtKey?: string; venueId?: string; onlyWithSpots?: boolean; limit?: number }

export interface VenueMapRow { id: string; name: string | null; kind: VenueKind; lat: number; lng: number;
  sport_ids: string[]; is_lit: boolean | null; is_free: boolean | null; surface: string | null; upcoming_events_count: number }
export interface VenueDetailRow { id: string; name: string | null; kind: VenueKind; lat: number; lng: number;
  district_key: string | null; address: string | null; surface: string | null; is_lit: boolean | null; is_free: boolean | null;
  is_indoor: boolean | null; access: string | null; opening_hours: string | null; website: string | null; phone: string | null;
  source: VenueSource; osm_type: string | null; osm_id: number | null; status: ModerationStatus; is_mock: boolean;
  sport_ids: string[]; photo_count: number; upcoming_events_count: number; has_pending_edit_by_me: boolean;
  is_mine: boolean; created_at: string; updated_at: string }
export interface VenuePhotoRow { id: string; storage_path: string | null; external_url: string | null;
  attribution: string | null; is_mine: boolean; created_at: string }
export interface VenueEditProposal { name?: string; surface?: string; is_lit?: boolean; is_free?: boolean;
  is_indoor?: boolean; opening_hours?: string; sport_ids?: string[] }

export interface EventCardRow { id: string; series_id: string | null; sport_id: string; title: string | null;
  starts_at: string; ends_at: string; spots_total: number; spots_taken: number; spots_reserved: number; spots_left: number;
  level: number | null; status: EventStatus; visibility: EventVisibility;
  venue_id: string; venue_name: string | null; venue_kind: VenueKind; venue_lat: number; venue_lng: number;
  district_key: string | null; distance_km: number | null;
  organizer_id: string | null; organizer_name: string | null; organizer_avatar_path: string | null;   // null for anon
  organizer_reliability: number | null; organizer_is_verified: boolean | null;
  my_status: ParticipantStatus | null; is_organizer: boolean }
export interface EventDetailRow extends EventCardRow { description: string | null; cancel_reason: string | null;
  venue_address: string | null; series_weekdays: number[] | null; conversation_id: string | null;
  can_join: boolean; attendance_open: boolean; created_at: string }
export interface ParticipantRow { user_id: string; display_name: string; avatar_path: string | null; is_verified: boolean;
  reliability_score: number | null; status: ParticipantStatus; is_organizer: boolean; level: number | null;
  joined_at: string; attended: boolean | null }
export interface CreateEventResult { event_id: string; series_id: string | null; conversation_id: string }
export interface JoinEventResult { spots_taken: number; spots_total: number; spots_reserved: number; conversation_id: string | null }
export interface AttendanceMark { user_id: string; attended: boolean }

export interface ConversationListRow { conversation_id: string; kind: ConversationKind; event_id: string | null;
  match_id: string | null; title: string | null; other_user_id: string | null; avatar_path: string | null;
  sport_id: string | null; event_starts_at: string | null; event_status: EventStatus | null;
  last_message_body: string | null; last_message_kind: MessageKind | null; last_message_at: string | null;
  last_message_sender_id: string | null; unread_count: number; muted: boolean }

export interface CandidateRow { user_id: string; display_name: string; avatar_path: string | null; bio: string | null;
  district_key: string | null; goal: UserGoal | null; is_verified: boolean; reliability_score: number | null;
  sport_ids: string[]; sport_levels: number[]; common_sport_ids: string[]; distance_km_approx: number | null;
  score: number; score_sport: number; score_level: number; score_schedule: number; score_distance: number }
export interface SwipeResult { match_id: string | null; conversation_id: string | null }
export interface ProposeMeetingResult { event_id: string; conversation_id: string }
export interface PersonSummaryRow { user_id: string; display_name: string; avatar_path: string | null; bio: string | null;
  district_key: string | null; goal: UserGoal | null; is_verified: boolean; reliability_score: number | null;
  attended_count: number; sport_ids: string[]; sport_levels: number[]; common_sport_ids: string[];
  distance_km_approx: number | null; match_id: string | null; conversation_id: string | null; is_me: boolean }
export interface BlockedUserRow { user_id: string; display_name: string; avatar_path: string | null; blocked_at: string }
export interface HomeLocationResult { district_key: string | null }
export interface UserSportInput { sport_id: string; level: Level }
export interface AvailabilitySlotInput { weekday: Weekday; day_part: DayPart }
export interface PushClaimRow { notification_id: string; user_id: string; type: NotificationType; payload: Json;
  locale: 'ru' | 'pl' | 'en'; tokens: string[] }

// table row aliases
export type TableRow<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type ProfileRow = TableRow<'profiles'>; export type MessageRow = TableRow<'messages'>;
export type NotificationRow = TableRow<'notifications'>; export type ProfilePrivateRow = TableRow<'profile_private'>;
```

`notifications.ts` holds the payload shapes. Every payload includes `url: string`.

| Type | Payload fields |
|---|---|
| `event_nearby` | `{event_id, sport_id, venue_name, venue_kind, starts_at, spots_left}` |
| `event_joined` | `{event_id, sport_id, starts_at, user_id, user_name, spots_left}` |
| `event_cancelled` | `{event_id, sport_id, starts_at, venue_name}` |
| `event_invite` | `{event_id, sport_id, starts_at, venue_name, from_user_id, from_name, conversation_id}` |
| `match` | `{match_id, conversation_id, other_user_id, other_name}` |
| `message` | `{conversation_id, conversation_kind, event_id \| null, sender_id, sender_name}` |
| `attendance_reminder` | `{event_id, sport_id, starts_at}` |

Export as `NotificationPayloads` keyed by type.

### 9.3 Domain constants

**`enums.ts`**: a `const` array plus a derived union for every enum in §3.1:
- `VENUE_KINDS`/`VenueKind`, `VENUE_SOURCES`, `MODERATION_STATUSES`, `VENUE_EDIT_KINDS`, `EDIT_STATUSES`;
- `EVENT_STATUSES`, `EVENT_VISIBILITIES`, `PARTICIPANT_STATUSES`, `CONVERSATION_KINDS`, `MESSAGE_KINDS`, `MATCH_STATUSES`;
- `DAY_PARTS`, `USER_GOALS`, `REPORT_TARGETS`, `REPORT_REASONS`, `REPORT_STATUSES`;
- `NOTIFICATION_TYPES`, `PUSH_STATUSES`, `PUSH_PLATFORMS`, `RUN_SOURCES`.

The values are exactly the SQL labels.

**`sports.ts`** (must equal the `sports` seed):

| id | sort | icon (MCI) | default_spots | default_duration_min | is_team | osm_values |
|---|---|---|---|---|---|---|
| `football` | 1 | `soccer` | 10 | 90 | true | soccer, futsal |
| `basketball` | 2 | `basketball` | 10 | 90 | true | basketball |
| `volleyball` | 3 | `volleyball` | 12 | 90 | true | volleyball, beachvolleyball |
| `tennis` | 4 | `tennis` | 2 | 60 | false | tennis |
| `padel` | 5 | `racquetball` | 4 | 90 | false | padel |
| `table_tennis` | 6 | `table-tennis` | 2 | 60 | false | table_tennis |
| `swimming` | 7 | `swim` | 4 | 60 | false | swimming |
| `workout` | 8 | `weight-lifter` | 4 | 60 | false | fitness, calisthenics |
| `running` | 9 | `run` | 6 | 60 | false | running, athletics |

Exports: `SPORT_IDS` (const tuple), `SportId`, `SPORTS: readonly SportDef[]`, `SPORTS_BY_ID`, `isSportId(x): x is SportId`.

**`levels.ts`**: `LEVELS = [1,2,3,4,5] as const`, `type Level`, `LEVEL_KEYS = {1:'beginner',2:'amateur',3:'intermediate',4:'advanced',5:'pro'}`, `type EventLevel = Level | null` (null = "any"). ru labels: Новичок / Любитель / Средний / Продвинутый / Профи / Любой уровень. pl: Początkujący / Amator / Średni / Zaawansowany / Profesjonalista / Dowolny poziom. en: Beginner / Amateur / Intermediate / Advanced / Pro / Any level.

**`availability.ts`**: `WEEKDAYS = [1,2,3,4,5,6,7] as const` (ISO, 1 = Mon), `type Weekday`, `DAY_PART_HOURS = { morning:[6,12], afternoon:[12,17], evening:[17,23] }`, `slotKey(w, p) => \`${w}:${p}\``.

**`constants.ts`**:
- `TIMEZONE = 'Europe/Warsaw'`, `WARSAW_CENTER = { lat: 52.2297, lng: 21.0122 }`;
- `SERVICE_AREA_BBOX = { minLat: 51.95, maxLat: 52.50, minLng: 20.70, maxLng: 21.45 }`;
- `EVENT_LIMITS = { minSpots: 2, maxSpots: 50, minDurationMin: 15, maxDurationMin: 480, maxDaysAhead: 60 }`;
- `SERIES_HORIZON_DAYS = 14`, `SERIES_MAX_WEEKS = 26`, `SERIES_DEFAULT_WEEKS = 8`, `ATTENDANCE_WINDOW_HOURS = 72`, `RELIABILITY_MIN_EVENTS = 3`;
- `NOTIFY_RADIUS_KM = { min: 1, max: 30, default: 5 }`;
- `TEXT_LIMITS = { displayName: 40, bio: 300, message: 2000, eventTitle: 80, eventDescription: 1000, venueName: 120 }`;
- `OSM_ATTRIBUTION = '© OpenStreetMap contributors (ODbL)'`;
- `DEFAULT_MAP_STYLES = { light: 'https://tiles.openfreemap.org/styles/liberty', dark: 'https://tiles.openfreemap.org/styles/dark' }`.

**`errors.ts`**: `RPC_ERROR_CODES` (the 14 codes in §5.0) and `type RpcErrorCode`.

**`storage.ts`**: `BUCKETS = { avatars: 'avatars', venuePhotos: 'venue-photos' } as const`, `type BucketId`, `avatarObjectPath(userId, fileId, ext = 'jpg')`, `venuePhotoObjectPath(venueId, userId, fileId, ext = 'jpg')`.

**`distance.ts`**: `approxDistanceKm(km: number | null): number | null` (same buckets as SQL) and `distanceLabelKind(n) => 'lte1' | 'approx' | 'gte30'`.

**`scoring.ts`**:
- `MATCH_SCORING = { sportFloor: 0.25, levelFloor: 0.25, scheduleFloor: 0.4, distanceFloor: 0.2, distanceDecayKm: 5, unknownSchedule: 0.5, unknownDistance: 0.3, sameDistrictKm: 3, maxRadiusKm: 30, passCooldownDays: 14 } as const`;
- `jaccard(a, b)`, `levelCloseness(pairs: [number, number][])`, `scheduleOverlap(a: string[], b: string[])`, `distanceFactor(km: number | null, sameDistrict: boolean)`, `matchScore({sport, level, schedule, distance})`.
- Unit tests in `__tests__/scoring.test.ts` (`node:test`).

### 9.4 Warsaw districts (18 dzielnice; stable keys)

Centres are approximate. They're used only as a fallback when an OSM boundary is missing.

| key | name | center (lat, lng) | key | name | center |
|---|---|---|---|---|---|
| `bemowo` | Bemowo | 52.2546, 20.9110 | `srodmiescie` | Śródmieście | 52.2319, 21.0067 |
| `bialoleka` | Białołęka | 52.3205, 20.9667 | `targowek` | Targówek | 52.2900, 21.0500 |
| `bielany` | Bielany | 52.2853, 20.9440 | `ursus` | Ursus | 52.1958, 20.8838 |
| `mokotow` | Mokotów | 52.1934, 21.0347 | `ursynow` | Ursynów | 52.1508, 21.0503 |
| `ochota` | Ochota | 52.2120, 20.9727 | `wawer` | Wawer | 52.1964, 21.1772 |
| `praga_poludnie` | Praga-Południe | 52.2394, 21.0838 | `wesola` | Wesoła | 52.2370, 21.2240 |
| `praga_polnoc` | Praga-Północ | 52.2580, 21.0350 | `wilanow` | Wilanów | 52.1650, 21.0880 |
| `rembertow` | Rembertów | 52.2589, 21.1573 | `wlochy` | Włochy | 52.1900, 20.9300 |
| `wola` | Wola | 52.2350, 20.9670 | `zoliborz` | Żoliborz | 52.2690, 20.9850 |

`sort_order` is alphabetical by Polish name. `districts.ts` exports `DISTRICTS` (key, name, center), `DistrictKey` and `DISTRICT_KEYS`. Key derivation from OSM names: strip diacritics, lowercase, `-` → `_`.

---

## 10. Seed & mock data policy

**`supabase/config.toml`** (a), key settings:
- `[api] schemas = ["public","graphql_public"]`, `extra_search_path = ["public","extensions"]`
- `[db] major_version = 17`
- `[db.seed] enabled = true`, `sql_paths = ["./seeds/00_local_vault.sql","./seeds/10_districts_osm.sql","./seeds/20_venues_osm.sql","./seeds/90_dev_mock.sql"]`
- `[auth] site_url = "http://localhost:8081"`, `additional_redirect_urls = ["bojo://"]`
- `[auth.email] enable_confirmations = false`, `otp_length = 6`, `otp_expiry = 600`, `max_frequency = "30s"`
- `[auth.email.template.magic_link]` and `[auth.email.template.confirmation]` both use `content_path = "./supabase/templates/otp.html"`. The template shows `{{ .Token }}` prominently in ru/pl/en.
- `[functions.push-dispatch] verify_jwt = false`, `[functions.delete-account] verify_jwt = true`
- Production needs custom SMTP (out of MVP scope).

**OSM import** (`npm run osm:import` → writes `supabase/seeds/10_districts_osm.sql` and `20_venues_osm.sql`; both committed, each with a header comment of ODbL attribution, Overpass timestamp and query hash):
- Area: `area(id:3600336075)` (relation 336075, Warszawa, admin_level 6).
- Venues query: `nwr["leisure"~"^(pitch|fitness_station|swimming_pool|sports_centre|track)$"](area.waw); out center tags;`
- Districts query: `rel["boundary"="administrative"]["admin_level"="9"](area.waw); (._;>;); out body;`, converted with osmtogeojson, simplified with `@turf/simplify` (tolerance 0.0005), and written as `update public.districts set boundary = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON('…'),4326))::geography where key = '…';`.
- Mapping (refined by the Overpass research task):
  - `leisure=pitch` + `sport` (split on `;`) mapped through `sports.osm_values` → kind `pitch`. `sport=multi` → football + basketball with `inferred=true`. Pitches with no mapped sport are skipped.
  - `leisure=fitness_station` → `fitness_station` + workout.
  - `leisure=track` + running/athletics → `track` + running.
  - `leisure=swimming_pool` → `swimming_pool` + swimming, only if `access ∉ {private,no}` and it has a `name` or `sport=swimming`.
  - `leisure=sports_centre` with a mapped `sport` → `sports_centre`.
  - Skip `access ∈ {private,no}` and any `disused:*`/`abandoned:*` tags.
  - Attribute mapping: `lit` → `is_lit`; `fee` → `is_free` (inverted); `indoor`/`covered` → `is_indoor`; `surface`, `opening_hours`, `name`, `addr:street`+`addr:housenumber` → `address`; `website`/`contact:website`; `phone`/`contact:phone`; raw tags → `osm_tags`.
- Ids: `uuidv5('osm/<type>/<id>', '5f8f2a3c-7d1e-4b6a-9c2d-0e4f6a8b1c3d')`.
- Inserts are batches of 500: `insert … on conflict (osm_type, osm_id) do update set location, osm_tags, osm_imported_at, and other attributes only when venues.locally_edited_at is null`. Then `venue_sports … on conflict do nothing`. Location is written as `'SRID=4326;POINT(lng lat)'::extensions.geography`.
- The script caches raw responses in `scripts/osm/.cache/`, tries `OVERPASS_URL` then the fallbacks with backoff, sends a User-Agent containing `OVERPASS_CONTACT`, and makes a single request per run.
- **No invented venue data.** Every venue row is from OSM, user-added at runtime, or flagged `is_mock=true`. MVP needs no mock venues.

**ODbL:** attribution `© OpenStreetMap contributors (ODbL)` must appear on the map overlay (b2), the venue detail when `source='osm'` (b2), and `settings → About` (d). The venue DB derived from OSM stays under ODbL.

**Dev mock data** (`seeds/90_dev_mock.sql`, local only, never run in production):
- 12 users `dev01@bojo.test`…`dev12@bojo.test` with fixed UUIDs `d0000000-0000-4000-8000-0000000000NN`. Insert into `auth.users` (`instance_id '00000000-0000-0000-0000-000000000000'`, `aud/role 'authenticated'`, `email_confirmed_at now()`, `raw_app_meta_data '{"provider":"email","providers":["email"]}'`, and `''` for `confirmation_token`, `recovery_token`, `email_change_token_new`, `email_change`) plus `auth.identities` (`provider 'email'`, `provider_id = user id`, `identity_data {sub,email,email_verified:true}`). The trigger creates the profiles, which are then updated with `display_name '[DEV] <Name>'`, `is_mock=true`, `onboarded_at=now()`, varied sports, levels, availability, districts, and home locations via `private.snap_home_point`.
- About 20 events over the next 7 days relative to `now()` at real OSM venues (selected by subquery on `venue_sports`), with titles prefixed `[DEV] ` and `is_mock=true`, some participants, one weekly series, one match with a conversation and a few messages.
- You can log in as any mock user via OTP: the code shows up in Mailpit.
- Dev data must be removable with `delete from auth.users where email like '%@bojo.test'` plus `delete … where is_mock`.

---

## 11. Phased implementation order & integration risks

### 11.1 Phases

1. **Wave A (parallel)**
   - **(a)** works in this order:
     1. `packages/shared` complete (the contract). Commit early; wave B depends on it.
     2. Migrations (§3–§7).
     3. `npx supabase db reset` passes, then `npm run db:types` replaces the hand-written types (fix any drift on the DB side).
     4. OSM import + seeds.
     5. Edge Functions.
     6. pgTAP tests (minimum): anon can't select profiles, messages or event_participants; a non-member can't read messages; a blocked user's messages are invisible; `profile_private` isn't readable cross-user; `match_candidates` and `person_summary` never return coordinates; `join_event` can't overfill (spots check); `events.spots_taken` isn't client-updatable.
   - **(b1)**: root workspace → `apps/mobile` scaffold + **all** dependencies → config → theme/UI kit/icons → i18n (all namespace files created) → Supabase client + OTP sign-in + AuthProvider + onboarding redirect → tabs + placeholder screens for every route in §2.2 → cross-feature stubs (§2.4) → `npm run typecheck`, `npx expo start --web` and a native bundle all pass.
2. **Wave B (parallel, after b1 is merged and (a)'s shared package exists)**
   - **(b2)** map + venues
   - **(c)** events + chats + notifications
   - **(d)** onboarding/profile/people/runs/safety

   Each develops against the local DB from (a). If (a) isn't finished, code against `@bojo/shared` types and verify later.
3. **Integration:** `npx supabase db reset` → `npm run db:types` → `npm run typecheck` → `npm run lint` → `npm test` → `npx supabase test db` → `npx expo export -p web` and `npx expo export -p ios` / `-p android` (bundle check) → manual smoke test in Expo Go + web → security and UX reviews.

### 11.2 Suggested migration files (a)

`20261015000001_extensions.sql`, `…02_enums.sql`, `…03_reference.sql` (districts + sports data), `…04_people.sql`, `…05_venues.sql`, `…06_events.sql`, `…07_social.sql`, `…08_helpers_triggers.sql`, `…09_rpc_venues.sql`, `…10_rpc_events.sql`, `…11_rpc_social.sql`, `…12_rpc_profile_safety.sql`, `…13_rls.sql`, `…14_grants.sql` (revoke-all + grants, must run last among DDL), `…15_storage.sql`, `…16_realtime.sql`, `…17_cron.sql`.

### 11.3 Rules: what each workstream must NOT do

- **Nobody but (a)** edits `supabase/**`, `packages/shared/**` or `scripts/**`. If you need an RPC change, describe it in your final report; don't work around it with direct table access.
- **Nobody but (b1)** edits any `package.json`, the lockfile, `app.config.ts`, `metro.config.js`, `tsconfig*`, `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `src/theme`, `src/components/ui`, `src/icons`, `src/lib` or `src/i18n/index.ts`. Wave-B agents put extra components in `src/features/<own>/components/`.
- Don't import `react-native-maps` or `maplibre-gl` outside `features/venues/VenueMap(.web).tsx`; anything else breaks the web or native bundle. c and d use `VenueMap` from `@/features/venues`.
- Don't query other users' rows directly where §5 provides an RPC: participants, conversations list, people. RLS will silently return nothing.
- No direct table writes except the grants in §4.3.
- No service role key, no hard-coded URLs or keys, no `EXPO_PUBLIC_*` secrets.
- No user-facing strings outside i18n; edit only your own namespaces. No TypeScript `enum` in shared code.
- Don't change cross-feature signatures (§2.4) or route params (§2.4).
- Don't send precise device location anywhere except rounded `events_feed` args (§8). Never display another user's location beyond `distance_km_approx` and district.
- Don't call `expo-notifications` push APIs outside the guard in §6.

### 11.4 Interfaces & integration risks

| Risk | Mitigation |
|---|---|
| Hand-written types drift from the real DB | (a) regenerates types as soon as migrations apply. Clients use the `rpc.types.ts` interfaces, which still compile against generated types. Integration runs `db:types` + `typecheck`. |
| Stubs vs real implementations conflict (the §2.4 barrels) | b1 writes the stubs with exact signatures; owners only replace bodies. Typecheck at integration. |
| `react-native-maps` leaking into the web bundle, or `maplibre-gl` into native | Platform file split + ESLint `no-restricted-imports` + `expo export -p web` / `-p ios` in CI. |
| Expo Go Android has no remote push; web has no push | Guarded registration, the in-app inbox and Realtime toast always work, and `push-dispatch` marks such users `skipped`. |
| Localhost unreachable from a phone running Expo Go | Use the LAN IP in `EXPO_PUBLIC_SUPABASE_URL`; document in README. |
| `pg_net` can't reach Edge Functions locally | `host.docker.internal:44321` works on Docker Desktop for Windows. If vault secrets are missing, the trigger is a no-op, so nothing breaks. |
| Overpass outages (observed 502/500) | Cache, fallback endpoints, committed generated SQL; the app never depends on Overpass at runtime. |
| Explicit `null` args to RPCs overriding defaults | Every defaulted arg is wrapped in `coalesce` (§5.0). |
| plpgsql OUT-param name collisions (`spots_taken`, `user_id`, …) | `#variable_conflict use_column` + alias-qualified columns (§5.0). |
| Supabase default grants exposing new tables | The final grants migration does a revoke-all; future migrations must add explicit grants; pgTAP tests check anon access. |
| Timezone bugs (today/weekend, series around DST) | All calendar maths in SQL with `Europe/Warsaw`. Client builds start times with `@date-fns/tz` (`warsawDateTimeISO`). |
| Organizer/participant identities leaking to anon | Anon has no table grants; RPCs null those fields; anon gets no Realtime. Covered by pgTAP. |
| React Native version mismatch (0.86.3 pinned vs 0.87 stated) | Always use `npx expo install` / `npx expo install --fix`. |

### 11.5 Workstream acceptance checklists

- **b2:** the map loads OSM venues for the viewport on iOS/Android/web; sport filter chips; clusters; dark style; locate-me; venue detail shows photos, attributes, sports, upcoming events (`EventCard`), "Create event here", "Suggest edit", "Add photo" (auth), report and OSM attribution; add venue with a crosshair pick + duplicate error handling.
- **c:**
  - Feed filters (sport multi, today/tomorrow/weekend/week/all, district, with spots) with a live counter.
  - Create flow in 4 taps with defaults: sport → venue → time chip → Create. Optional recurring weekly toggle and propose-meeting mode.
  - Event detail: join/leave/cancel, participant list (blocked users hidden), chat entry, attendance screen.
  - Generic chat with Realtime, optimistic send, `event_invite` card (Accept/Decline), system messages.
  - Chats list with unread counts; notifications inbox; push registration.
- **d:**
  - Onboarding: name/avatar → sports+levels → availability grid → district/home area/goal → `complete_onboarding`.
  - Profile with reliability ("92% · 12 games", shown when total ≥ 3) and verified badge; edit profile; settings (theme, language, radius, push, blocked users, sign out, delete account, About/ODbL).
  - Swipe deck (gesture + buttons, `~N km`, common sports, why-chips from score components), match modal → chat / propose meeting.
  - Person screen; ReportSheet / useBlockUser; runs stub (pace/distance prefs in `runner_profiles`, group runs via `useEventsFeed({sportIds:['running']})`, disabled "Import from Strava / Apple Health / Google Fit — soon").

---

### Appendix A — RPC error → UX

`event_full` → "No spots left" plus refetch. `event_not_joinable` → "Event already started or was cancelled". `not_found` → generic "Not available". `profile_incomplete` → route to `/onboarding`. `rate_limited` → "Too many actions, try later". `outside_service_area` → "Bojo works in Warsaw for now". `duplicate_venue` → offer to open the existing venue (id in `error.details`).

### Appendix B — React Query keys (`src/lib/queryKeys.ts`, b1) & invalidation

`qk.me = ['me']`, `qk.myPrivate = ['me','private']`, `qk.mySports = ['me','sports']`, `qk.myAvailability = ['me','availability']`, `qk.blocked = ['me','blocked']`, `qk.runner = ['me','runner']`, `qk.venuesBbox(bbox, sportIds) = ['venues','bbox',bbox,sportIds]`, `qk.venue(id) = ['venue',id]`, `qk.venuePhotos(id) = ['venue',id,'photos']`, `qk.eventsFeed(params) = ['events','feed',params]`, `qk.myEvents(scope) = ['events','mine',scope]`, `qk.event(id) = ['event',id]`, `qk.eventParticipants(id) = ['event',id,'participants']`, `qk.conversations = ['conversations']`, `qk.messages(cid) = ['messages',cid]`, `qk.conversationMembers(cid) = ['conversation',cid,'members']`, `qk.candidates(sportId) = ['people','candidates',sportId ?? null]`, `qk.person(id) = ['person',id]`, `qk.notifications = ['notifications']`.

Invalidation after mutations:
- join/leave/cancel/remove/create: `['events']`, `qk.event(id)`, `qk.eventParticipants(id)`, `qk.conversations`.
- swipe with a match, or unmatch/block: `qk.conversations`, `['people']`.
- profile writes: `qk.me` and the relevant `['me',…]` key.
- `add_venue_photo` / `suggest_venue_edit`: `qk.venue(id)`, `qk.venuePhotos(id)`.

---

### Critical files
- `packages/shared/src/rpc.types.ts` (and sibling `database.types.ts`, `sports.ts`, `districts.ts`, `scoring.ts`): the contract every client workstream codes against
- `supabase/migrations/` (especially the events, helpers/triggers, RLS and grants migrations): schema, `join_event`, `match_candidates`, RLS and privileges
- `apps/mobile/app/_layout.tsx` and `apps/mobile/app/(tabs)/_layout.tsx`: providers, auth/onboarding gating, navigation shell
- `apps/mobile/src/features/venues/VenueMap.tsx` / `VenueMap.web.tsx` / `VenueMap.types.ts`: the cross-platform map boundary
- `supabase/functions/push-dispatch/index.ts` together with `supabase/config.toml`: push outbox delivery, OTP templates, seed order
