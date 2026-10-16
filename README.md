# Bojo — с кем поиграть сегодня

Мобильное и веб-приложение для спортсменов: карта площадок Варшавы, события «футбол 5×5 сегодня в 18:00, не хватает троих», подбор напарников по спорту, уровню, графику и району. Одна кодовая база для iOS, Android и веба (Expo + Expo Router), бэкенд на Supabase (Postgres + PostGIS).

- Архитектура и все решения: [`ARCHITECTURE.md`](ARCHITECTURE.md) (раздел «Кратко» и §0 сверху).
- Дизайн-принципы: [`docs/DESIGN.md`](docs/DESIGN.md) · правила команды: [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) · импорт OSM: [`docs/OSM_IMPORT.md`](docs/OSM_IMPORT.md).
- Статус задач: [`TASKS.md`](TASKS.md).

## Структура

```
apps/mobile        Expo-приложение (iOS / Android / web), маршруты в src/app
packages/shared    @bojo/shared — типы БД, RPC-контракт, справочники (виды спорта, районы), скоринг
supabase           миграции, RLS, RPC, сиды, pgTAP-тесты, Edge Functions
scripts/osm        импорт площадок Варшавы из OpenStreetMap (Overpass) → SQL-сиды
```

## Требования

- **Node.js 22 или 24 LTS** (на Node 25 тоже работает, но у него сломанный глобальный `localStorage`, который ломает некоторые библиотеки при серверном рендеринге), npm 10+.
- **Docker Desktop** — для локального Supabase.
- Для телефона: приложение **Expo Go** (SDK 57). На iOS Expo Go для SDK 57 требует входа: `npx expo login` тем же аккаунтом, что и в приложении.

## Быстрый старт (локально)

```bash
# 1. Зависимости (только из корня — npm workspaces)
npm install

# 2. Локальный Supabase: Postgres+PostGIS, Auth, Realtime, Storage, Mailpit
npm run db:start          # первый запуск скачивает Docker-образы
npm run db:reset          # миграции + сиды: 2 657 площадок OSM, районы, [DEV]-пользователи и события

# 3. Переменные окружения приложения
cp apps/mobile/.env.example apps/mobile/.env
#   EXPO_PUBLIC_SUPABASE_URL      = API URL из `npx supabase status` (http://127.0.0.1:44321)
#   EXPO_PUBLIC_SUPABASE_ANON_KEY = anon / publishable key из `npx supabase status`
cp supabase/functions/.env.example supabase/functions/.env   # для push-dispatch (dev-плейсхолдер)

# 4. Запуск
npm run web               # веб: http://localhost:8081
npm run dev               # Metro + QR-код для Expo Go (iOS/Android)
```

**Вход.** Email → 6-значный код. Локально письма не уходят наружу, а попадают в Mailpit: <http://127.0.0.1:44324>.
Готовые тестовые аккаунты: `dev01@bojo.test` … `dev12@bojo.test` (заполненные профили, `dev01` — модератор; у `dev01` и `dev02` есть матч и чат).

**Телефон в Expo Go.** Телефон и компьютер в одной Wi-Fi сети; в `apps/mobile/.env` укажите `EXPO_PUBLIC_SUPABASE_URL=http://<LAN-IP компьютера>:44321` (для эмулятора Android — `http://10.0.2.2:44321`) и перезапустите `npm run dev`.

**Порты локального Supabase — 44320–44329** (API 44321, БД 44322, Studio 44323, Mailpit 44324), а не стандартные 543xx. Windows с Hyper-V/WSL при загрузке резервирует случайные блоки портов в динамическом диапазоне 49152–65535 (посмотреть: `netsh interface ipv4 show excludedportrange protocol=tcp`), и стандартные порты Supabase туда попадают. Порты ниже 49152 не резервируются. Если `npm run db:start` всё же пишет `ports are not available`, перезапустите службу WinNAT от администратора: `net stop winnat && net start winnat`.

## Переменные окружения

Секреты в репозиторий не попадают: коммитятся только `*.example`, реальные `.env` в `.gitignore`. Индекс всех переменных — [`.env.example`](.env.example).

| Файл | Переменная | Назначение |
|---|---|---|
| `apps/mobile/.env` | `EXPO_PUBLIC_SUPABASE_URL` | URL Supabase API |
| | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | публичный anon/publishable ключ (не service role!) |
| | `EXPO_PUBLIC_EAS_PROJECT_ID` | опционально; без него remote push отключён, in-app уведомления работают |
| | `EXPO_PUBLIC_MAP_STYLE_LIGHT` / `_DARK` | опционально; стили веб-карты (по умолчанию OpenFreeMap, без ключа) |
| | `GOOGLE_MAPS_ANDROID_API_KEY` / `GOOGLE_MAPS_IOS_API_KEY` | только для standalone-сборок; Expo Go ключ не нужен |
| `supabase/functions/.env` | `PUSH_DISPATCH_SECRET` | общий секрет триггера уведомлений и функции `push-dispatch` |
| | `EXPO_ACCESS_TOKEN` | опционально, для Expo enhanced push security |
| `scripts/osm/.env` | `OVERPASS_URL`, `OVERPASS_FALLBACK_URLS`, `OVERPASS_CONTACT` | импорт OSM; `OVERPASS_CONTACT` пустой по умолчанию |

## Команды

| Команда | Что делает |
|---|---|
| `npm run web` / `npm run dev` | веб / Metro для Expo Go |
| `npm run typecheck` | TypeScript во всех пакетах |
| `npm run lint` | ESLint + проверка, что ключи i18n совпадают в ru/pl/en |
| `npm test` | юнит-тесты (`@bojo/shared` — скоринг, дистанции) |
| `npm run db:start` / `db:stop` / `db:reset` | локальный Supabase |
| `npm run db:test` | pgTAP-тесты БД: RLS, приватность, события, матчинг |
| `npm run db:types` | перегенерировать `packages/shared/src/database.types.ts` из локальной БД |
| `npm run functions:serve` | локально запустить Edge Functions |
| `npm run osm:import` | заново выгрузить площадки Варшавы из Overpass → `supabase/seeds/*_osm.sql` |
| `cd apps/mobile && npx expo export -p web` | продакшн-сборка веба в `dist/` |

## Данные и лицензии

Площадки — из OpenStreetMap: © OpenStreetMap contributors, лицензия ODbL 1.0. Таблица площадок является производной базой данных OSM. Атрибуция показывается на карте, на карточке площадки и в «Настройки → О приложении». Подложка веб-карты: OpenFreeMap © OpenMapTiles. Выдуманных площадок нет; тестовые пользователи и события в `supabase/seeds/90_dev_mock.sql` помечены `[DEV]` и `is_mock = true` и предназначены только для локальной разработки.

## Безопасность: что закрыто и что нужно до продакшна

Код прошёл независимое ревью безопасности (RLS, RPC, Storage, Realtime, Edge Functions, приватность геоданных); найденные критичные и средние проблемы исправлены миграциями и покрыты pgTAP-тестами. Модель приватности: другие пользователи видят только район и грубое расстояние между ячейками ~2 км («до 3 км», «~5 км», …); точные координаты пользователей не хранятся и не отдаются (см. `ARCHITECTURE.md` §8).

Перед продакшном обязательно:
- **CAPTCHA** (Cloudflare Turnstile или hCaptcha) на запрос кода входа: лимит писем GoTrue общий на проект, без капчи его можно выбрать и заблокировать вход всем.
- **Собственный SMTP** и повышенный лимит писем; периодическая чистка неподтверждённых `auth.users`.
- **Не применять** `supabase/seeds/90_dev_mock.sql` и `00_local_vault.sql` к продакшн-базе (там dev-модератор и плейсхолдер секрета). Реальные vault-секреты задаются вручную.
- **Ограничить ключи Google Maps** по package name / bundle id (они попадают в нативные бинарники).
- Решить политику **удаления аккаунта** (GDPR): сейчас сообщения пользователя остаются с `sender_id = NULL`, загруженные фото площадок — тоже.

Известные ограничения MVP (низкий риск, в бэклоге): квоты на загрузки в Storage и удаление объекта при скрытии фото модератором; лимит `create_event` считает серию за одно событие; имя отправителя — свободный текст в заголовке push; код входа 6-значный (защита — лимит попыток на IP + будущая капча); удаление EXIF выполняется на клиенте при перекодировании.

## Деплой (кратко)

1. Создать проект Supabase (Postgres 17), включить расширения PostGIS, pg_net, pg_cron; `npx supabase link` → `npx supabase db push`; залить `supabase/seeds/10_districts_osm.sql` и `20_venues_osm.sql` (без `90_dev_mock.sql`).
2. В SQL-редакторе создать vault-секреты `bojo_functions_url` и `bojo_dispatch_secret`; задеплоить функции `push-dispatch` и `delete-account` с тем же `PUSH_DISPATCH_SECRET`.
3. Настроить собственный SMTP для писем с кодом входа; в Auth → Hooks подключить **Custom Access Token hook** `private.auth_token_hook` (запрещает вход по паролю — только код из письма), включить подтверждение email и CAPTCHA.
4. Мобильные сборки — EAS Build (`eas init` → `EXPO_PUBLIC_EAS_PROJECT_ID`, ключи Google Maps для Android).
