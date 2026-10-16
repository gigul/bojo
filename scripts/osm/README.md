# @bojo/osm-import

Imports Warsaw sports venues and the 18 district (dzielnica) boundaries from OpenStreetMap via the Overpass API
and writes **committed** SQL seeds:

- `supabase/seeds/10_districts_osm.sql` — `update public.districts set boundary = …` (PostGIS assembles the polygons
  from member ways with `ST_BuildArea`, simplified with `ST_SimplifyPreserveTopology`, tolerance 0.0001°)
- `supabase/seeds/20_venues_osm.sql` — idempotent upserts into `venues` + `venue_sports`

The app never calls Overpass at runtime. Rules follow `docs/OSM_IMPORT.md` (+ ARCHITECTURE §10, §0 A4).

## Run

Zero npm dependencies — Node ≥ 22.18 runs the TypeScript directly (native type stripping).

```sh
cp scripts/osm/.env.example scripts/osm/.env    # optional
node scripts/osm/src/main.ts                     # = npm run osm:import (fetch with cache, then build)
node scripts/osm/src/main.ts --fetch-only        # only download into .cache/
node scripts/osm/src/main.ts --offline           # rebuild seeds from .cache/ only (no network)
node scripts/osm/src/main.ts --refresh           # ignore the cache, re-download everything
node scripts/osm/src/main.ts --force             # allow a >20% drop in a venue kind count
node --test scripts/osm/src/*.test.ts            # unit tests
```
Then `npx -y supabase@2.121.0 db reset`.

## Etiquette / robustness

- 7 sequential Warsaw-only queries (`pitches`, `swimming`, `workout`, `running`, `sports_centres`, `containers`,
  `districts`), one at a time, ≥ 5 s apart, `/api/status` slot check, `Retry-After` on 429.
- Endpoint fallback order from `docs/OSM_IMPORT.md` (overridable via `OVERPASS_URL` / `OVERPASS_FALLBACK_URLS`),
  exponential backoff between rounds, gives up after `OVERPASS_MAX_WAIT_MIN` (default 15) per query.
- A 200 response whose `remark` contains a runtime error is treated as a **partial result** (failure); responses
  older than 14 days (`osm3s.timestamp_osm_base`) and empty results are rejected.
- `User-Agent: bojo-osm-import/0.1 (dev)` — `OVERPASS_CONTACT` is optional and empty by default; never put a
  personal email there without its owner's consent. No other headers carry personal data.
- Raw responses are cached in `scripts/osm/.cache/` (gitignored), keyed by query hash. Output is deterministic
  for the same input (no wall-clock timestamps), so re-runs are diffable.
- Aborts if any venue kind count drops by > 20% versus the previous seed (`--force` to override).

## Mapping onto the Bojo schema

| OSM | `venues.kind` | sports |
|---|---|---|
| `leisure=pitch` + mapped `sport` | `pitch` | via `sport` (soccer/futsal/… → football, beachvolleyball → volleyball, …); `sport=multi` → football+basketball+volleyball with `inferred=true`; `athletics` on a pitch (jump pits) is not mapped |
| `leisure=sports_centre/stadium/sports_hall` | `sports_centre` | own sports (gym-only `fitness`/`crossfit` dropped) ∪ sports of the pitches/pools/tracks inside it |
| `leisure=swimming_pool`, `water_park` | `swimming_pool` | swimming |
| `leisure=fitness_station/outdoor_fitness`, `fitness_station=*` | `fitness_station` | workout |
| `leisure=track` (no sport or running/athletics) | `track` | running |
| `route=running/fitness_trail` relations | `running_route` | running / workout (none exist in Warsaw today) |
| other named objects with a mapped sport | `other` | via `sport` |

Attributes: `surface` = normalized class (`grass, artificial_turf, asphalt, concrete, clay, hard, tartan, sand, wood,
other`; raw value stays in `osm_tags.surface`), `lit` → `is_lit`, `fee`/`charge` → `is_free`,
`indoor`/`location`/`covered` → `is_indoor`, raw `access`, raw `opening_hours`, `addr:street + addr:housenumber`
→ `address`, `website`/`contact:website`, `phone`/`contact:phone`, all raw tags → `osm_tags`.

Exclusions: access `private/no/military/staff/…`; lifecycle (`disused:*`, `abandoned:*`, `construction`,
`proposed`, `opening_hours=closed`); `shop/club/office/craft`; `leisure=fitness_centre`; indoor fitness stations;
wading/reflecting/plunge/spa pools; pools without access tag and without public signals (name, operator,
opening_hours, fee, website, sport) unless inside a sports centre; pitches with no mapped sport;
tracks for cycling/horses/motor sports.

Grouping ("places, not features"): features inside a sports centre / stadium / water park polygon are merged into
that container venue; fitness equipment inside a fitness-station area is merged into the area; free-standing
equipment nodes within 40 m form one venue; a pitch node ≤ 30 m from a pitch polygon of the same sport is a
duplicate. Merged children are listed in `osm_tags["bojo:grouped"]`. Derived flags live in
`osm_tags["bojo:flags"]`: `on_school_grounds`, `customers_only`, `restricted_access` (members/students/residents/
permit → imported with `status='hidden'`).

Upsert semantics: `(osm_type, osm_id)` → deterministic id `uuidv5('osm/<type>/<id>', 5f8f2a3c-7d1e-4b6a-9c2d-0e4f6a8b1c3d)`.
Rows with `locally_edited_at` keep their attributes and sports (only location/tags/import timestamp refresh).
OSM venues missing from a newer import are soft-deleted (`status='hidden'`).

## License

Data © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright). The venue table is a
Derivative Database and stays under ODbL; the attribution must be shown on the map, on OSM venue details and in
Settings → About.
