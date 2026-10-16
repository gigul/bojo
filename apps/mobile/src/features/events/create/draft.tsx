// CreateEventDraft context for the create flow (event/create/_layout.tsx). Route contract (§2.4):
// ?sportId skips step 1, ?venueId skips step 2, ?matchId switches to propose_meeting mode.
import { isSportId, type VenueDetailRow, type VenueKind } from '@bojo/shared';
import { useQuery } from '@tanstack/react-query';
import { router, useNavigation, type Href } from 'expo-router';
import { createContext, useContext, useState, type ReactNode } from 'react';

import { useAuth } from '@/lib/auth';
import { qk } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

import { isUuid } from '../api';

export type StepKey = 'sport' | 'venue' | 'time' | 'details';

export interface DraftVenue {
  id: string;
  name: string | null;
  kind: VenueKind;
  sportIds?: string[];
  /** Differentiates unnamed venues in the summary ("Теннисный корт · Мокотув"). */
  districtKey?: string | null;
}

export interface CreateDraft {
  sportId: string | null;
  venue: DraftVenue | null;
  /** UTC ISO start time. */
  startsAt: string | null;
  matchId: string | null;
  presetSport: boolean;
  presetVenue: boolean;
}

interface DraftContextValue {
  draft: CreateDraft;
  update: (patch: Partial<CreateDraft>) => void;
  steps: StepKey[];
}

const DraftContext = createContext<DraftContextValue | null>(null);

export interface CreateFlowParams {
  venueId?: string;
  sportId?: string;
  matchId?: string;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** `venue_detail` for a preset ?venueId (name + kind + sports for the summary). */
function usePresetVenue(venueId: string | null) {
  return useQuery({
    queryKey: [...qk.venue(venueId ?? ''), 'create-brief'] as const,
    queryFn: async (): Promise<DraftVenue | null> => {
      const { data, error } = await supabase.rpc('venue_detail', { p_venue_id: venueId ?? '' });
      if (error) throw error;
      const row: VenueDetailRow | undefined = data?.[0];
      return row
        ? {
            id: row.id,
            name: row.name,
            kind: row.kind,
            sportIds: row.sport_ids,
            districtKey: row.district_key,
          }
        : null;
    },
    enabled: Boolean(venueId),
    staleTime: 5 * 60_000,
  });
}

export function CreateDraftProvider({
  params,
  children,
}: {
  params: { venueId?: string | string[]; sportId?: string | string[]; matchId?: string | string[] };
  children: ReactNode;
}) {
  const [initial] = useState(() => {
    const sportId = first(params.sportId);
    const venueId = first(params.venueId);
    const matchId = first(params.matchId);
    return {
      sportId: sportId && isSportId(sportId) ? sportId : null,
      venueId: venueId && isUuid(venueId) ? venueId : null,
      matchId: matchId && isUuid(matchId) ? matchId : null,
    };
  });
  const [draft, setDraft] = useState<CreateDraft>({
    sportId: initial.sportId,
    venue: initial.venueId ? { id: initial.venueId, name: null, kind: 'other' } : null,
    startsAt: null,
    matchId: initial.matchId,
    presetSport: initial.sportId !== null,
    presetVenue: initial.venueId !== null,
  });
  const presetVenue = usePresetVenue(initial.venueId);
  // Merge the fetched venue name/kind into the draft while the preset venue is still selected.
  const venue =
    draft.venue && presetVenue.data && draft.venue.id === presetVenue.data.id && !draft.venue.name
      ? presetVenue.data
      : draft.venue;

  const steps: StepKey[] = [];
  if (!draft.presetSport) steps.push('sport');
  if (!draft.presetVenue) steps.push('venue');
  steps.push('time', 'details');

  const value: DraftContextValue = {
    draft: { ...draft, venue },
    update: (patch) => setDraft((d) => ({ ...d, ...patch })),
    steps,
  };
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useCreateDraft(): DraftContextValue {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useCreateDraft must be used inside <CreateDraftProvider>');
  return ctx;
}

export const STEP_PATHS: Record<StepKey, Href> = {
  sport: '/event/create',
  venue: '/event/create/venue',
  time: '/event/create/time',
  details: '/event/create/details',
};

export function nextStepPath(steps: StepKey[], current: StepKey): Href {
  const i = steps.indexOf(current);
  const next = steps[i + 1] ?? 'details';
  return STEP_PATHS[next];
}

/** "Шаг 2 из 4" numbers for a step. */
export function stepNumber(steps: StepKey[], current: StepKey): { n: number; total: number } {
  return { n: Math.max(1, steps.indexOf(current) + 1), total: steps.length };
}

/** Leaves the whole create flow (pops the nested stack from the root stack). */
export function useCloseFlow(): () => void {
  const navigation = useNavigation();
  return () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) parent.goBack();
    else router.replace('/events');
  };
}

/** Own sports (user_sports, readable by RLS) to show first in step 1. */
export function useMySportIds() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: [...qk.mySports, 'create-order'] as const,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('user_sports')
        .select('sport_id,level')
        .eq('user_id', userId ?? '')
        .order('level', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => r.sport_id);
    },
    enabled: userId !== null,
    staleTime: 5 * 60_000,
  });
}
