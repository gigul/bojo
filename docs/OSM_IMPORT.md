# Импорт площадок из OpenStreetMap (Overpass API)

Площадки в Bojo берутся **только из OSM** (или из явно помеченных моков `is_mock=true` для разработки). Приложение **никогда** не ходит в Overpass в рантайме: данные импортируются скриптом `scripts/osm` в нашу БД.

## Эндпоинты и заголовки (проверено 2026-10-15)
- Обязателен осмысленный `User-Agent` (с дефолтным UA Node → HTTP 406). Используем `bojo-osm-import/0.1 (dev)`. **Никаких email/личных данных в заголовках.**
- Запрос: `POST`, `Content-Type: application/x-www-form-urlencoded; charset=UTF-8`, тело `data=<urlencoded QL>`, `Accept: application/json`.
- Порядок фоллбэка: `overpass-api.de` → `z.overpass-api.de` → `lz4.overpass-api.de` → `overpass.private.coffee` → `overpass.kumi.systems` → `maps.mail.ru/osm/tools/overpass` → `overpass.openstreetmap.fr`. Основной сервер часто перегружен (502 «request queue full») — экспоненциальный бэкофф. `overpass.osm.ch` — только Швейцария, не использовать.
- Этикет: один запрос за раз, пауза 5 с между запросами; перед запросом читать `/api/status` и ждать свободный слот; уважать `Retry-After` на 429.
- Ответ 200 с `remark`, содержащим «runtime error», = **частичные данные** → считать ошибкой. Проверять `osm3s.timestamp_osm_base` (не старше 14 дней). Пустой результат по pitches = ошибка (зеркало без области Варшавы).

## Область Варшавы
`is_in(52.2318,21.006)` → `area.a["boundary"="administrative"]["name"="Warszawa"]`, предпочитать `admin_level=6`. Area id = 3600000000 + relation id (ожидается relation 336075 → area 3600336075 — проверить при первом запуске и зафиксировать).

## Запросы
Префикс: `[out:json][timeout:180][maxsize:268435456];area(id:<AREA>)->.waw;`
- **pitches**: `nwr["leisure"="pitch"](area.waw); out center tags;`
- **swimming**: `( nwr["leisure"="swimming_pool"](area.waw); nwr["leisure"="water_park"](area.waw); nwr["sport"~"swimming"](area.waw); ); out center tags;`
- **workout**: `( nwr["leisure"~"^(fitness_station|outdoor_fitness)$"](area.waw); nwr["fitness_station"](area.waw); nwr["sport"~"fitness|calisthenics|crossfit|workout"](area.waw); ); out center tags;`
- **running**: `( nwr["leisure"="track"](area.waw); nwr["sport"~"running|athletics"](area.waw); rel["route"~"^(running|fitness_trail)$"](area.waw); ); out center tags;`
- **sports_centres**: `( nwr["leisure"~"^(sports_centre|stadium|sports_hall)$"](area.waw); ); out center tags;`
- **containers** (только для группировки «что внутри чего»): `( wr["leisure"~"^(sports_centre|stadium|water_park|fitness_station|outdoor_fitness)$"](area.waw); wr["amenity"~"^(school|college|university)$"](area.waw); ); out geom;`

`out center tags` не возвращает имён/ID редакторов — персональные данные не сохраняем.

## Нормализация
Поля: `osm_type`, `osm_id`, `name`, `name_pl`, `name_en`, `category`, `sports[]`, `lat/lng` (node или center), `surface`, `lit`, `fee`, `opening_hours` (сырой), `access_class`, `indoor`, `covered`, `website`, `phone`, `operator`, `address{}`, `photos{}` (ссылки на внешние фото — с их лицензиями), `flags[]`, `tags` (все сырые теги — провенанс). Дедуп по `(osm_type, osm_id)`.

**Спорт** (тег `sport` делится по `;`):
| OSM | наш ключ |
|---|---|
| soccer, football, futsal, beach_soccer | football |
| tennis | tennis |
| basketball, streetball | basketball |
| volleyball | volleyball (на `surface=sand` → beach_volleyball) |
| beachvolleyball, beach_volleyball | beach_volleyball |
| table_tennis | table_tennis |
| padel, padel_tennis, paddle_tennis | padel |
| swimming | swimming |
| fitness, calisthenics, street_workout, crossfit | workout |
| running, athletics | running |
| multi | multi |
Не мапить: american_football, australian_football, gaelic_games, rugby, table_soccer.
`category`: `multi`, если sport содержит multi или ≥2 наших видов; бассейны/аквапарки → swimming; fitness_station/outdoor_fitness → workout; треки и running-маршруты → running; fitness_trail → workout.

**Покрытие**: grass (grass, grass_paver) · artificial_turf (artificial_turf, artificial_grass, astroturf) · asphalt · concrete (concrete, concrete:plates, paving_stones, sett) · clay · hard (acrylic, hard, plastic tiles) · tartan (tartan, rubber, polyurethane, epdm) · sand · wood (wood, parquet, pvc, vinyl) · other · unknown. Для списков берётся первое значение.
**lit**: yes (yes, automatic, 24/7, sunset-sunrise, limited, расписание) · no (no, disused) · unknown.
**fee**: free (no, donation) · paid (yes*, значения с цифрами, либо есть `charge`) · unknown.
**indoor**: yes для indoor=yes/room/area или location=indoor.

## Исключения
- access: private, no, military, staff, employees, delivery, agricultural, forestry, emergency → **исключить**. customers → оставить, флаг `customers_only`. members, students, residents, permit → оставить, флаг `restricted_access` (скрыто по умолчанию). permissive/destination/yes/public/designated/нет тега → public.
- disused / abandoned / construction / proposed / opening_hours=closed|off.
- pitch без sport или с неподдерживаемым sport.
- leisure=fitness_centre; sports_centre только с fitness/yoga/dance/martial arts; indoor fitness_station.
- треки cycling/horse/motor/karting.
- объекты с тегами shop/club/office/craft.
- Бассейны: исключить wading/reflecting/plunge/hot_tub/spa/fountain; бассейн без access оставлять только при признаках публичного объекта (name, operator, opening_hours, fee, website, sport, явный public/customers access или внутри sports_centre/water_park/stadium), иначе — вероятно частный садовый.

## Подводные камни
1. sports_centre-полигон и корты внутри приходят вместе → группировать (container), считать «места», а не фичи.
2. `fitness_station` = и вся площадка, и отдельный тренажёр → тренажёры внутри области группировать; свободные в радиусе 40 м — одно место.
3. Один корт может быть и точкой, и полигоном → точка в ≤30 м от полигона того же спорта = возможный дубль.
4. center у relation = центр bbox, может быть вне объекта.
5. Пограничные объекты могут иметь центр вне Варшавы.
6. Школьные пло­щадки (в т.ч. «Orlik») часто без access, но с ограниченными часами → флаг `on_school_grounds`.
7. OSM id не вечны (split/merge, точка→полигон).

## Лицензия (ODbL 1.0)
- Атрибуция «© OpenStreetMap contributors» со ссылкой на https://www.openstreetmap.org/copyright — в углу карты (в мобильном — через видимый ⓘ/© контрол) и на карточке площадки с данными OSM. Подложку (тайлы) атрибутировать отдельно; `tile.openstreetmap.org` для прод-трафика не использовать.
- Таблица площадок — Derivative Database: при публичном использовании выдавать производные данные (включая пользовательские правки OSM-полей) под ODbL по запросу.
- Наши данные (события, игроки, рейтинги, фото пользователей) — в отдельных таблицах, связь только по id → не попадают под share-alike.
- Правки пользователей — в overlay-таблице; в идеале — отправлять обратно в OSM.
- Внешние фото (Wikimedia Commons, Mapillary CC BY-SA 4.0, Panoramax, `image=*`) имеют свои лицензии — показывать с атрибуцией автора или не показывать.

## Обновление
Upsert по `(osm_type, osm_id)`; хранить теги, хэш тегов, timestamp данных, `first_seen`, `last_seen`, `osm_deleted_at`. Еженедельный реимпорт. Пользовательские правки — в overlay, импорт их не перезаписывает; если OSM-значение изменилось после правки — флаг на ревью. Пропавшие объекты — soft-delete (на них ссылаются события), попытка перепривязки к новому id того же типа в ≤30 м. Прервать импорт, если число объектов в категории упало > 20%. Для прода — суточные выгрузки Geofabrik (mazowieckie) + osmium с теми же правилами.
