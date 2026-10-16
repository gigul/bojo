-- Bojo — venues (ARCHITECTURE §3.4)

create table public.venues (
  id                uuid primary key default gen_random_uuid(),     -- OSM rows: uuid v5 of 'osm/<type>/<id>'
  name              text check (name is null or char_length(name) between 1 and 120),  -- OSM often unnamed → UI fallback
  kind              public.venue_kind not null,
  location          extensions.geography(Point,4326) not null,      -- point or centroid of area
  route_path        extensions.geography(LineString,4326),          -- running routes (stub, unused in MVP)
  district_key      text references public.districts(key),          -- SERVER-ONLY (trigger)
  address           text check (address is null or char_length(address) <= 200),
  surface           text check (surface is null or char_length(surface) <= 40),        -- surface class, see shared VENUE_SURFACES
  is_lit            boolean,                                         -- null = unknown
  is_free           boolean,                                         -- OSM fee=no → true, fee=yes → false
  is_indoor         boolean,
  access            text,                                            -- raw OSM access
  opening_hours     text check (opening_hours is null or char_length(opening_hours) <= 255), -- raw OSM syntax
  website           text,
  phone             text,
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
create index venues_created_by_idx on public.venues (created_by, created_at desc);

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
create index venue_photos_uploader_idx on public.venue_photos (uploaded_by, created_at desc);

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
