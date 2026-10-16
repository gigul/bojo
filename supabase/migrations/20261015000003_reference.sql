-- Bojo — reference tables + data (ARCHITECTURE §3.2, §9.3, §9.4).
-- Data must equal packages/shared/src/{sports,districts}.ts.

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
  icon                 text not null,                        -- pictogram key (= sport id, §0 A2)
  default_spots        smallint not null check (default_spots between 2 and 50),
  default_duration_min smallint not null check (default_duration_min between 15 and 480),
  is_team              boolean not null default false,
  osm_values           text[] not null default '{}',         -- OSM sport=* values mapped to this sport
  is_active            boolean not null default true
);

insert into public.districts (key, name, center, sort_order) values
  ('bemowo',         'Bemowo',         'SRID=4326;POINT(20.9110 52.2546)', 1),
  ('bialoleka',      'Białołęka',      'SRID=4326;POINT(20.9667 52.3205)', 2),
  ('bielany',        'Bielany',        'SRID=4326;POINT(20.9440 52.2853)', 3),
  ('mokotow',        'Mokotów',        'SRID=4326;POINT(21.0347 52.1934)', 4),
  ('ochota',         'Ochota',         'SRID=4326;POINT(20.9727 52.2120)', 5),
  ('praga_poludnie', 'Praga-Południe', 'SRID=4326;POINT(21.0838 52.2394)', 6),
  ('praga_polnoc',   'Praga-Północ',   'SRID=4326;POINT(21.0350 52.2580)', 7),
  ('rembertow',      'Rembertów',      'SRID=4326;POINT(21.1573 52.2589)', 8),
  ('srodmiescie',    'Śródmieście',    'SRID=4326;POINT(21.0067 52.2319)', 9),
  ('targowek',       'Targówek',       'SRID=4326;POINT(21.0500 52.2900)', 10),
  ('ursus',          'Ursus',          'SRID=4326;POINT(20.8838 52.1958)', 11),
  ('ursynow',        'Ursynów',        'SRID=4326;POINT(21.0503 52.1508)', 12),
  ('wawer',          'Wawer',          'SRID=4326;POINT(21.1772 52.1964)', 13),
  ('wesola',         'Wesoła',         'SRID=4326;POINT(21.2240 52.2370)', 14),
  ('wilanow',        'Wilanów',        'SRID=4326;POINT(21.0880 52.1650)', 15),
  ('wlochy',         'Włochy',         'SRID=4326;POINT(20.9300 52.1900)', 16),
  ('wola',           'Wola',           'SRID=4326;POINT(20.9670 52.2350)', 17),
  ('zoliborz',       'Żoliborz',       'SRID=4326;POINT(20.9850 52.2690)', 18);

insert into public.sports (id, sort_order, icon, default_spots, default_duration_min, is_team, osm_values) values
  ('football',     1, 'football',     10, 90, true,  array['soccer','football','futsal','beach_soccer']),
  ('basketball',   2, 'basketball',   10, 90, true,  array['basketball','streetball']),
  ('volleyball',   3, 'volleyball',   12, 90, true,  array['volleyball','beachvolleyball','beach_volleyball']),
  ('tennis',       4, 'tennis',        2, 60, false, array['tennis']),
  ('padel',        5, 'padel',         4, 90, false, array['padel','padel_tennis','paddle_tennis']),
  ('table_tennis', 6, 'table_tennis',  2, 60, false, array['table_tennis']),
  ('swimming',     7, 'swimming',      4, 60, false, array['swimming']),
  ('workout',      8, 'workout',       4, 60, false, array['fitness','calisthenics','street_workout','crossfit']),
  ('running',      9, 'running',       6, 60, false, array['running','athletics']);
