# Development guide (team conventions)

Binding docs: `ARCHITECTURE.md` (§0 amendments override the rest), `docs/DESIGN.md` (visual system), `docs/OSM_IMPORT.md` (venue data).

## Local stack
- Supabase runs in Docker: API `http://127.0.0.1:44321`, Studio `http://127.0.0.1:44323`, Mailpit (OTP emails) `http://127.0.0.1:44324` (REST: `GET /api/v1/messages`, `GET /api/v1/message/<ID>`).
- `npx supabase status` shows URLs and keys; `apps/mobile/.env` (gitignored) holds the local URL + anon key. Never commit keys.
- Dev users: `dev01@bojo.test` … `dev12@bojo.test` (onboarded, `[DEV]` names, `is_mock=true`; dev01 is a moderator). Sign in with the email → read the 6-digit code from Mailpit. ~20 `[DEV]` events at real OSM venues over the next days; dev01↔dev02 have a match + chat.
- Venues: 2 657 real OSM venues in Warsaw (ODbL). No mock venues.
- Web dev server: `cd apps/mobile && npx expo start --web --port <port>`. Don't set `CI=1` (it disables file watching). `.env` changes need a restart. On Windows, stop it by killing the node PID (killing the shell wrapper leaves it running).

## Commands (repo root)
- `npm run typecheck` — tsc for all workspaces.
- `npm run lint` — expo lint + i18n key parity (ru/pl/en must have identical keys).
- `npx expo export --platform web|android|ios --output-dir <tmp>` (from `apps/mobile`) — bundle check; delete the output afterwards.
- `npx supabase test db` — pgTAP (147 assertions).

## Ownership (ARCHITECTURE §2.1, §11.3)
- (a) `supabase/**`, `packages/shared/**`, `scripts/osm/**`
- (b1) root config, every `package.json`/lockfile, `apps/mobile` config, `src/app/_layout.tsx`, `src/app/(tabs)/_layout.tsx`, `src/app/sign-in.tsx`, `src/theme`, `src/components/ui`, `src/icons`, `src/lib`, `src/i18n/index.ts`, i18n ns `common|auth|errors|vocab`
- (b2) `src/app/(tabs)/index.tsx`, `src/app/venue/**`, `src/features/venues/**`, ns `map|venues`
- (c) `src/app/(tabs)/events.tsx`, `src/app/(tabs)/chats.tsx`, `src/app/event/**`, `src/app/chat/**`, `src/app/notifications.tsx`, `src/features/{events,chat,notifications}/**`, ns `events|chat|notifications`
- (d) `src/app/(tabs)/people.tsx`, `src/app/(tabs)/profile.tsx`, `src/app/onboarding/**`, `src/app/person/**`, `src/app/runs/**`, `src/app/settings.tsx`, `src/app/edit-profile.tsx`, `src/features/{onboarding,profile,people,runs,safety}/**`, ns `onboarding|profile|people|runs|safety|settings`
- Routes live in `apps/mobile/src/app/` (A6). Cross-feature imports only via barrels `@/features/<name>` with the exact §2.4 signatures.

## Code conventions (set by b1)
- Styling: `useThemedStyles(createStyles)` with tokens from `useTheme()`; no hard-coded colours — use token names (`'textMuted'`, `'primaryText'`…). Lime (`primary`) is a fill colour only; `primaryText` for accent-coloured text/icons.
- UI kit `@/components/ui`: Screen, Text, Button, IconButton, Chip, Card, Avatar, AvatarStack, Badge, SpotsBadge, TextField, OtpInput, Stepper, Segmented, Sheet, EmptyState, ErrorState, Skeleton, ListItem, Toast (`useToast().show(text, tone)`), ChipRow (scrolls on phones, wraps on wide screens), SwitchRow, `headerBackOptions(label)` (localised 44 pt back button). Icons: `SportIcon {sportId, size?, color?, active?}`, `Icon {name: Feather}`.
- `Screen` default `edges` = `['bottom','left','right']` (under a Stack header); tab screens pass `['top','left','right']`.
- Dates: `formatEventWhen(iso, locale)` etc. from `@/lib/datetime` — pass `useLanguage()` (React Compiler caches otherwise). Format helpers take `t`.
- i18n: `t('ns:key')` keys are type-checked against `ru`; add every key to ru, pl, en in your own namespaces only. No hard-coded user-facing strings, no exclamation marks, short friendly tone.
- Data: one `api.ts` per feature with React Query hooks; keys from `qk` (`@/lib/queryKeys`); RPC results typed with `@bojo/shared` row types; errors → `useErrorText()`.
- Accessibility: ≥44pt targets, `accessibilityRole`/labels (on web the kit maps to `aria-*`), state never by colour alone, summary `accessibilityLabel` on cards.
- Selection state: react-native-web ignores `accessibilityState`. Use the kit (`Chip selection="toggle|radio|none"`, `Segmented semantics="tabs|radio"`, `IconButton selected`) or `selectionA11y(kind, selected)` for custom rows; radio chips go inside a `role="radiogroup"` container. Never put `aria-label` on a role-less view (use `VisuallyHidden` text).
- Venue names: always `venueName({ name, kind, sportIds, districtKey }, t)` from `@/lib/venueName` (sport-based name + district for unnamed OSM venues); `{ district: false }` where the district is shown next to it.
- Privacy: never send precise device location except rounded `events_feed` args; never show another user's location beyond `~N km` + district.
- Dev showcase: `/dev/ui` (dev only) shows every primitive and pictogram in both themes.
