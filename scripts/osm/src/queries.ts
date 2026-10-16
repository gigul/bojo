// Overpass QL queries, verbatim from docs/OSM_IMPORT.md "Запросы" (+ the districts query, ARCHITECTURE §10).
// Warszawa = relation 336075 (admin_level 6) → area 3600336075.

export const WARSAW_RELATION_ID = 336075;
export const WARSAW_AREA_ID = 3600000000 + WARSAW_RELATION_ID;

const PREFIX = `[out:json][timeout:180][maxsize:268435456];area(id:${WARSAW_AREA_ID})->.waw;`;

export interface QueryDef {
  name: string;
  query: string;
  /** An empty result is treated as an error (mirror without the Warsaw area). */
  requireNonEmpty: boolean;
}

export const VENUE_QUERIES: QueryDef[] = [
  {
    name: 'pitches',
    requireNonEmpty: true,
    query: `${PREFIX}nwr["leisure"="pitch"](area.waw); out center tags;`,
  },
  {
    name: 'swimming',
    requireNonEmpty: true,
    query: `${PREFIX}( nwr["leisure"="swimming_pool"](area.waw); nwr["leisure"="water_park"](area.waw); nwr["sport"~"swimming"](area.waw); ); out center tags;`,
  },
  {
    name: 'workout',
    requireNonEmpty: true,
    query: `${PREFIX}( nwr["leisure"~"^(fitness_station|outdoor_fitness)$"](area.waw); nwr["fitness_station"](area.waw); nwr["sport"~"fitness|calisthenics|crossfit|workout"](area.waw); ); out center tags;`,
  },
  {
    name: 'running',
    requireNonEmpty: true,
    query: `${PREFIX}( nwr["leisure"="track"](area.waw); nwr["sport"~"running|athletics"](area.waw); rel["route"~"^(running|fitness_trail)$"](area.waw); ); out center tags;`,
  },
  {
    name: 'sports_centres',
    requireNonEmpty: true,
    query: `${PREFIX}( nwr["leisure"~"^(sports_centre|stadium|sports_hall)$"](area.waw); ); out center tags;`,
  },
  {
    name: 'containers',
    requireNonEmpty: true,
    query: `${PREFIX}( wr["leisure"~"^(sports_centre|stadium|water_park|fitness_station|outdoor_fitness)$"](area.waw); wr["amenity"~"^(school|college|university)$"](area.waw); ); out geom;`,
  },
];

/** Districts (admin_level 9 dzielnice) with member geometry; `.waw out ids tags` echoes the area for verification. */
export const DISTRICTS_QUERY: QueryDef = {
  name: 'districts',
  requireNonEmpty: true,
  query: `${PREFIX}.waw out tags; rel["boundary"="administrative"]["admin_level"="9"](area.waw); out geom;`,
};
