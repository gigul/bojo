// Typed overlay over the GENERATED database.types.ts (which `npm run db:types` overwrites; this file survives).
// Postgres `jsonb` outputs are generated as `Json`; here they are narrowed to their real shapes so that
// `supabase.rpc(...)` results stay assignable to the hand-written interfaces in rpc.types.ts.
// `@bojo/shared` exports THIS `Database` (use it for `createClient<Database>`).
import type { Database as GeneratedDatabase } from './database.types';
import type { ParticipantPreview } from './rpc.types';

type GenFns = GeneratedDatabase['public']['Functions'];

type WithPreview<R> = Omit<R, 'participants_preview'> & {
  participants_preview: ParticipantPreview[] | null;
};

type NarrowPreview<K extends keyof GenFns> = GenFns[K] extends { Returns: (infer R)[] }
  ? Omit<GenFns[K], 'Returns'> & { Returns: WithPreview<R>[] }
  : GenFns[K];

type PreviewFns = 'events_feed' | 'my_events' | 'event_detail';

export type Database = Omit<GeneratedDatabase, 'public'> & {
  public: Omit<GeneratedDatabase['public'], 'Functions'> & {
    Functions: Omit<GenFns, PreviewFns> & { [K in PreviewFns]: NarrowPreview<K> };
  };
};
