export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      availability_slots: {
        Row: {
          day_part: Database['public']['Enums']['day_part'];
          user_id: string;
          weekday: number;
        };
        ComputedFields: never;
        Insert: {
          day_part: Database['public']['Enums']['day_part'];
          user_id: string;
          weekday: number;
        };
        Update: {
          day_part?: Database['public']['Enums']['day_part'];
          user_id?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'availability_slots_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        ComputedFields: never;
        Insert: {
          blocked_id: string;
          blocker_id: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'blocks_blocked_id_fkey';
            columns: ['blocked_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blocks_blocker_id_fkey';
            columns: ['blocker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      conversation_members: {
        Row: {
          conversation_id: string;
          joined_at: string;
          last_read_at: string | null;
          muted: boolean;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          conversation_id: string;
          joined_at?: string;
          last_read_at?: string | null;
          muted?: boolean;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          joined_at?: string;
          last_read_at?: string | null;
          muted?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversation_members_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversation_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      conversations: {
        Row: {
          created_at: string;
          event_id: string | null;
          id: string;
          kind: Database['public']['Enums']['conversation_kind'];
          last_message_at: string | null;
          match_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          event_id?: string | null;
          id?: string;
          kind: Database['public']['Enums']['conversation_kind'];
          last_message_at?: string | null;
          match_id?: string | null;
        };
        Update: {
          created_at?: string;
          event_id?: string | null;
          id?: string;
          kind?: Database['public']['Enums']['conversation_kind'];
          last_message_at?: string | null;
          match_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'conversations_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: true;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversations_match_id_fkey';
            columns: ['match_id'];
            isOneToOne: true;
            referencedRelation: 'matches';
            referencedColumns: ['id'];
          },
        ];
      };
      districts: {
        Row: {
          boundary: unknown;
          center: unknown;
          key: string;
          name: string;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          boundary?: unknown;
          center: unknown;
          key: string;
          name: string;
          sort_order: number;
        };
        Update: {
          boundary?: unknown;
          center?: unknown;
          key?: string;
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      event_participants: {
        Row: {
          event_id: string;
          joined_at: string;
          left_at: string | null;
          status: Database['public']['Enums']['participant_status'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          event_id: string;
          joined_at?: string;
          left_at?: string | null;
          status?: Database['public']['Enums']['participant_status'];
          user_id: string;
        };
        Update: {
          event_id?: string;
          joined_at?: string;
          left_at?: string | null;
          status?: Database['public']['Enums']['participant_status'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_participants_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_participants_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      event_series: {
        Row: {
          created_at: string;
          description: string | null;
          duration_min: number;
          id: string;
          is_active: boolean;
          is_mock: boolean;
          level: number | null;
          organizer_id: string;
          sport_id: string;
          spots_reserved: number;
          spots_total: number;
          start_time: string;
          starts_on: string;
          timezone: string;
          title: string | null;
          until_on: string | null;
          venue_id: string;
          visibility: Database['public']['Enums']['event_visibility'];
          weekdays: number[];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          duration_min: number;
          id?: string;
          is_active?: boolean;
          is_mock?: boolean;
          level?: number | null;
          organizer_id: string;
          sport_id: string;
          spots_reserved?: number;
          spots_total: number;
          start_time: string;
          starts_on: string;
          timezone?: string;
          title?: string | null;
          until_on?: string | null;
          venue_id: string;
          visibility?: Database['public']['Enums']['event_visibility'];
          weekdays: number[];
        };
        Update: {
          created_at?: string;
          description?: string | null;
          duration_min?: number;
          id?: string;
          is_active?: boolean;
          is_mock?: boolean;
          level?: number | null;
          organizer_id?: string;
          sport_id?: string;
          spots_reserved?: number;
          spots_total?: number;
          start_time?: string;
          starts_on?: string;
          timezone?: string;
          title?: string | null;
          until_on?: string | null;
          venue_id?: string;
          visibility?: Database['public']['Enums']['event_visibility'];
          weekdays?: number[];
        };
        Relationships: [
          {
            foreignKeyName: 'event_series_organizer_id_fkey';
            columns: ['organizer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_series_sport_id_fkey';
            columns: ['sport_id'];
            isOneToOne: false;
            referencedRelation: 'sports';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_series_venue_id_fkey';
            columns: ['venue_id'];
            isOneToOne: false;
            referencedRelation: 'venues';
            referencedColumns: ['id'];
          },
        ];
      };
      events: {
        Row: {
          cancel_reason: string | null;
          cancelled_at: string | null;
          created_at: string;
          description: string | null;
          ends_at: string;
          id: string;
          is_mock: boolean;
          level: number | null;
          organizer_id: string;
          series_id: string | null;
          sport_id: string;
          spots_reserved: number;
          spots_taken: number;
          spots_total: number;
          starts_at: string;
          status: Database['public']['Enums']['event_status'];
          title: string | null;
          updated_at: string;
          venue_id: string;
          visibility: Database['public']['Enums']['event_visibility'];
        };
        ComputedFields: never;
        Insert: {
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          description?: string | null;
          ends_at: string;
          id?: string;
          is_mock?: boolean;
          level?: number | null;
          organizer_id: string;
          series_id?: string | null;
          sport_id: string;
          spots_reserved?: number;
          spots_taken?: number;
          spots_total: number;
          starts_at: string;
          status?: Database['public']['Enums']['event_status'];
          title?: string | null;
          updated_at?: string;
          venue_id: string;
          visibility?: Database['public']['Enums']['event_visibility'];
        };
        Update: {
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          description?: string | null;
          ends_at?: string;
          id?: string;
          is_mock?: boolean;
          level?: number | null;
          organizer_id?: string;
          series_id?: string | null;
          sport_id?: string;
          spots_reserved?: number;
          spots_taken?: number;
          spots_total?: number;
          starts_at?: string;
          status?: Database['public']['Enums']['event_status'];
          title?: string | null;
          updated_at?: string;
          venue_id?: string;
          visibility?: Database['public']['Enums']['event_visibility'];
        };
        Relationships: [
          {
            foreignKeyName: 'events_organizer_id_fkey';
            columns: ['organizer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_series_id_fkey';
            columns: ['series_id'];
            isOneToOne: false;
            referencedRelation: 'event_series';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_sport_id_fkey';
            columns: ['sport_id'];
            isOneToOne: false;
            referencedRelation: 'sports';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_venue_id_fkey';
            columns: ['venue_id'];
            isOneToOne: false;
            referencedRelation: 'venues';
            referencedColumns: ['id'];
          },
        ];
      };
      matches: {
        Row: {
          created_at: string;
          id: string;
          status: Database['public']['Enums']['match_status'];
          unmatched_at: string | null;
          user_a: string;
          user_b: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          status?: Database['public']['Enums']['match_status'];
          unmatched_at?: string | null;
          user_a: string;
          user_b: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          status?: Database['public']['Enums']['match_status'];
          unmatched_at?: string | null;
          user_a?: string;
          user_b?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'matches_user_a_fkey';
            columns: ['user_a'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'matches_user_b_fkey';
            columns: ['user_b'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: {
          body: string;
          conversation_id: string;
          created_at: string;
          id: string;
          kind: Database['public']['Enums']['message_kind'];
          payload: Json | null;
          sender_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          body?: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['message_kind'];
          payload?: Json | null;
          sender_id?: string | null;
        };
        Update: {
          body?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['message_kind'];
          payload?: Json | null;
          sender_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string;
          dedupe_key: string | null;
          id: string;
          payload: NonNullable<Json>;
          push_attempts: number;
          push_claimed_at: string | null;
          push_error: string | null;
          push_status: Database['public']['Enums']['push_status'];
          read_at: string | null;
          sent_at: string | null;
          type: Database['public']['Enums']['notification_type'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          dedupe_key?: string | null;
          id?: string;
          payload?: NonNullable<Json>;
          push_attempts?: number;
          push_claimed_at?: string | null;
          push_error?: string | null;
          push_status?: Database['public']['Enums']['push_status'];
          read_at?: string | null;
          sent_at?: string | null;
          type: Database['public']['Enums']['notification_type'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          dedupe_key?: string | null;
          id?: string;
          payload?: NonNullable<Json>;
          push_attempts?: number;
          push_claimed_at?: string | null;
          push_error?: string | null;
          push_status?: Database['public']['Enums']['push_status'];
          read_at?: string | null;
          sent_at?: string | null;
          type?: Database['public']['Enums']['notification_type'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profile_private: {
        Row: {
          home_location: unknown;
          home_location_changes_count: number;
          home_location_changes_on: string | null;
          home_location_updated_at: string | null;
          locale: string;
          notify_radius_km: number;
          push_enabled: boolean;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          home_location?: unknown;
          home_location_changes_count?: number;
          home_location_changes_on?: string | null;
          home_location_updated_at?: string | null;
          locale?: string;
          notify_radius_km?: number;
          push_enabled?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          home_location?: unknown;
          home_location_changes_count?: number;
          home_location_changes_on?: string | null;
          home_location_updated_at?: string | null;
          locale?: string;
          notify_radius_km?: number;
          push_enabled?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profile_private_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          attended_count: number;
          avatar_path: string | null;
          bio: string | null;
          created_at: string;
          discoverable: boolean;
          display_name: string;
          district_key: string | null;
          goal: Database['public']['Enums']['user_goal'] | null;
          id: string;
          is_mock: boolean;
          is_verified: boolean;
          no_show_count: number;
          onboarded_at: string | null;
          reliability_score: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          attended_count?: number;
          avatar_path?: string | null;
          bio?: string | null;
          created_at?: string;
          discoverable?: boolean;
          display_name?: string;
          district_key?: string | null;
          goal?: Database['public']['Enums']['user_goal'] | null;
          id: string;
          is_mock?: boolean;
          is_verified?: boolean;
          no_show_count?: number;
          onboarded_at?: string | null;
          reliability_score?: number | null;
          updated_at?: string;
        };
        Update: {
          attended_count?: number;
          avatar_path?: string | null;
          bio?: string | null;
          created_at?: string;
          discoverable?: boolean;
          display_name?: string;
          district_key?: string | null;
          goal?: Database['public']['Enums']['user_goal'] | null;
          id?: string;
          is_mock?: boolean;
          is_verified?: boolean;
          no_show_count?: number;
          onboarded_at?: string | null;
          reliability_score?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_district_key_fkey';
            columns: ['district_key'];
            isOneToOne: false;
            referencedRelation: 'districts';
            referencedColumns: ['key'];
          },
        ];
      };
      push_tokens: {
        Row: {
          created_at: string;
          last_seen_at: string;
          platform: Database['public']['Enums']['push_platform'];
          token: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          last_seen_at?: string;
          platform: Database['public']['Enums']['push_platform'];
          token: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          last_seen_at?: string;
          platform?: Database['public']['Enums']['push_platform'];
          token?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_tokens_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      ratings: {
        Row: {
          attended: boolean;
          created_at: string;
          event_id: string;
          ratee_id: string;
          rater_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          attended: boolean;
          created_at?: string;
          event_id: string;
          ratee_id: string;
          rater_id: string;
          updated_at?: string;
        };
        Update: {
          attended?: boolean;
          created_at?: string;
          event_id?: string;
          ratee_id?: string;
          rater_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ratings_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ratings_ratee_id_fkey';
            columns: ['ratee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ratings_rater_id_fkey';
            columns: ['rater_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reports: {
        Row: {
          created_at: string;
          details: string | null;
          id: string;
          reason: Database['public']['Enums']['report_reason'];
          reporter_id: string;
          status: Database['public']['Enums']['report_status'];
          target_id: string;
          target_type: Database['public']['Enums']['report_target'];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          details?: string | null;
          id?: string;
          reason: Database['public']['Enums']['report_reason'];
          reporter_id: string;
          status?: Database['public']['Enums']['report_status'];
          target_id: string;
          target_type: Database['public']['Enums']['report_target'];
        };
        Update: {
          created_at?: string;
          details?: string | null;
          id?: string;
          reason?: Database['public']['Enums']['report_reason'];
          reporter_id?: string;
          status?: Database['public']['Enums']['report_status'];
          target_id?: string;
          target_type?: Database['public']['Enums']['report_target'];
        };
        Relationships: [
          {
            foreignKeyName: 'reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      runner_profiles: {
        Row: {
          pace_fast_sec_per_km: number | null;
          pace_slow_sec_per_km: number | null;
          preferred_distance_km: number | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          pace_fast_sec_per_km?: number | null;
          pace_slow_sec_per_km?: number | null;
          preferred_distance_km?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          pace_fast_sec_per_km?: number | null;
          pace_slow_sec_per_km?: number | null;
          preferred_distance_km?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'runner_profiles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      runs: {
        Row: {
          created_at: string;
          distance_m: number;
          duration_s: number;
          external_id: string | null;
          id: string;
          source: Database['public']['Enums']['run_source'];
          started_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          distance_m: number;
          duration_s: number;
          external_id?: string | null;
          id?: string;
          source?: Database['public']['Enums']['run_source'];
          started_at: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          distance_m?: number;
          duration_s?: number;
          external_id?: string | null;
          id?: string;
          source?: Database['public']['Enums']['run_source'];
          started_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'runs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      sports: {
        Row: {
          default_duration_min: number;
          default_spots: number;
          icon: string;
          id: string;
          is_active: boolean;
          is_team: boolean;
          osm_values: string[];
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          default_duration_min: number;
          default_spots: number;
          icon: string;
          id: string;
          is_active?: boolean;
          is_team?: boolean;
          osm_values?: string[];
          sort_order: number;
        };
        Update: {
          default_duration_min?: number;
          default_spots?: number;
          icon?: string;
          id?: string;
          is_active?: boolean;
          is_team?: boolean;
          osm_values?: string[];
          sort_order?: number;
        };
        Relationships: [];
      };
      swipes: {
        Row: {
          created_at: string;
          liked: boolean;
          sport_id: string | null;
          swiper_id: string;
          target_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          liked: boolean;
          sport_id?: string | null;
          swiper_id: string;
          target_id: string;
        };
        Update: {
          created_at?: string;
          liked?: boolean;
          sport_id?: string | null;
          swiper_id?: string;
          target_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'swipes_sport_id_fkey';
            columns: ['sport_id'];
            isOneToOne: false;
            referencedRelation: 'sports';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'swipes_swiper_id_fkey';
            columns: ['swiper_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'swipes_target_id_fkey';
            columns: ['target_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_sports: {
        Row: {
          created_at: string;
          level: number;
          sport_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          level: number;
          sport_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          level?: number;
          sport_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_sports_sport_id_fkey';
            columns: ['sport_id'];
            isOneToOne: false;
            referencedRelation: 'sports';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_sports_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      venue_edits: {
        Row: {
          comment: string | null;
          created_at: string;
          created_by: string;
          id: string;
          kind: Database['public']['Enums']['venue_edit_kind'];
          previous: Json | null;
          proposed: NonNullable<Json>;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database['public']['Enums']['edit_status'];
          venue_id: string;
        };
        ComputedFields: never;
        Insert: {
          comment?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          kind: Database['public']['Enums']['venue_edit_kind'];
          previous?: Json | null;
          proposed?: NonNullable<Json>;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database['public']['Enums']['edit_status'];
          venue_id: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          kind?: Database['public']['Enums']['venue_edit_kind'];
          previous?: Json | null;
          proposed?: NonNullable<Json>;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database['public']['Enums']['edit_status'];
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'venue_edits_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'venue_edits_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'venue_edits_venue_id_fkey';
            columns: ['venue_id'];
            isOneToOne: false;
            referencedRelation: 'venues';
            referencedColumns: ['id'];
          },
        ];
      };
      venue_photos: {
        Row: {
          attribution: string | null;
          created_at: string;
          external_url: string | null;
          id: string;
          is_mock: boolean;
          status: Database['public']['Enums']['moderation_status'];
          storage_path: string | null;
          uploaded_by: string | null;
          venue_id: string;
        };
        ComputedFields: never;
        Insert: {
          attribution?: string | null;
          created_at?: string;
          external_url?: string | null;
          id?: string;
          is_mock?: boolean;
          status?: Database['public']['Enums']['moderation_status'];
          storage_path?: string | null;
          uploaded_by?: string | null;
          venue_id: string;
        };
        Update: {
          attribution?: string | null;
          created_at?: string;
          external_url?: string | null;
          id?: string;
          is_mock?: boolean;
          status?: Database['public']['Enums']['moderation_status'];
          storage_path?: string | null;
          uploaded_by?: string | null;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'venue_photos_uploaded_by_fkey';
            columns: ['uploaded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'venue_photos_venue_id_fkey';
            columns: ['venue_id'];
            isOneToOne: false;
            referencedRelation: 'venues';
            referencedColumns: ['id'];
          },
        ];
      };
      venue_sports: {
        Row: {
          inferred: boolean;
          sport_id: string;
          venue_id: string;
        };
        ComputedFields: never;
        Insert: {
          inferred?: boolean;
          sport_id: string;
          venue_id: string;
        };
        Update: {
          inferred?: boolean;
          sport_id?: string;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'venue_sports_sport_id_fkey';
            columns: ['sport_id'];
            isOneToOne: false;
            referencedRelation: 'sports';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'venue_sports_venue_id_fkey';
            columns: ['venue_id'];
            isOneToOne: false;
            referencedRelation: 'venues';
            referencedColumns: ['id'];
          },
        ];
      };
      venues: {
        Row: {
          access: string | null;
          address: string | null;
          created_at: string;
          created_by: string | null;
          district_key: string | null;
          id: string;
          is_free: boolean | null;
          is_indoor: boolean | null;
          is_lit: boolean | null;
          is_mock: boolean;
          kind: Database['public']['Enums']['venue_kind'];
          locally_edited_at: string | null;
          location: unknown;
          name: string | null;
          opening_hours: string | null;
          osm_id: number | null;
          osm_imported_at: string | null;
          osm_tags: Json | null;
          osm_type: string | null;
          phone: string | null;
          route_path: unknown;
          source: Database['public']['Enums']['venue_source'];
          status: Database['public']['Enums']['moderation_status'];
          surface: string | null;
          updated_at: string;
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          access?: string | null;
          address?: string | null;
          created_at?: string;
          created_by?: string | null;
          district_key?: string | null;
          id?: string;
          is_free?: boolean | null;
          is_indoor?: boolean | null;
          is_lit?: boolean | null;
          is_mock?: boolean;
          kind: Database['public']['Enums']['venue_kind'];
          locally_edited_at?: string | null;
          location: unknown;
          name?: string | null;
          opening_hours?: string | null;
          osm_id?: number | null;
          osm_imported_at?: string | null;
          osm_tags?: Json | null;
          osm_type?: string | null;
          phone?: string | null;
          route_path?: unknown;
          source?: Database['public']['Enums']['venue_source'];
          status?: Database['public']['Enums']['moderation_status'];
          surface?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          access?: string | null;
          address?: string | null;
          created_at?: string;
          created_by?: string | null;
          district_key?: string | null;
          id?: string;
          is_free?: boolean | null;
          is_indoor?: boolean | null;
          is_lit?: boolean | null;
          is_mock?: boolean;
          kind?: Database['public']['Enums']['venue_kind'];
          locally_edited_at?: string | null;
          location?: unknown;
          name?: string | null;
          opening_hours?: string | null;
          osm_id?: number | null;
          osm_imported_at?: string | null;
          osm_tags?: Json | null;
          osm_type?: string | null;
          phone?: string | null;
          route_path?: unknown;
          source?: Database['public']['Enums']['venue_source'];
          status?: Database['public']['Enums']['moderation_status'];
          surface?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'venues_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'venues_district_key_fkey';
            columns: ['district_key'];
            isOneToOne: false;
            referencedRelation: 'districts';
            referencedColumns: ['key'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_venue: {
        Args: {
          p_is_free?: boolean;
          p_is_indoor?: boolean;
          p_is_lit?: boolean;
          p_kind: Database['public']['Enums']['venue_kind'];
          p_lat: number;
          p_lng: number;
          p_name: string;
          p_opening_hours?: string;
          p_sport_ids: string[];
          p_surface?: string;
        };
        Returns: string;
      };
      add_venue_photo: { Args: { p_storage_path: string; p_venue_id: string }; Returns: string };
      block_user: { Args: { p_user_id: string }; Returns: undefined };
      blocked_users: {
        Args: Record<PropertyKey, never>;
        Returns: {
          avatar_path: string;
          blocked_at: string;
          display_name: string;
          user_id: string;
        }[];
      };
      cancel_event: { Args: { p_event_id: string; p_reason?: string }; Returns: undefined };
      cancel_series: { Args: { p_series_id: string }; Returns: undefined };
      claim_push_batch: {
        Args: { p_ids?: string[]; p_limit?: number };
        Returns: {
          locale: string;
          notification_id: string;
          payload: Json;
          tokens: string[];
          type: Database['public']['Enums']['notification_type'];
          user_id: string;
        }[];
      };
      clear_home_location: { Args: Record<PropertyKey, never>; Returns: undefined };
      complete_onboarding: { Args: Record<PropertyKey, never>; Returns: undefined };
      complete_push_batch: {
        Args: { p_invalid_tokens?: string[]; p_results: Json };
        Returns: undefined;
      };
      create_event: {
        Args: {
          p_description?: string;
          p_duration_min?: number;
          p_level?: number;
          p_repeat_until?: string;
          p_repeat_weekdays?: number[];
          p_sport_id: string;
          p_spots_reserved?: number;
          p_spots_total?: number;
          p_starts_at: string;
          p_title?: string;
          p_venue_id: string;
        };
        Returns: {
          conversation_id: string;
          event_id: string;
          series_id: string;
        }[];
      };
      decline_invite: { Args: { p_event_id: string }; Returns: undefined };
      event_detail: {
        Args: { p_event_id: string };
        Returns: {
          attendance_open: boolean;
          can_join: boolean;
          cancel_reason: string;
          conversation_id: string;
          created_at: string;
          description: string;
          distance_km: number;
          district_key: string;
          ends_at: string;
          id: string;
          is_organizer: boolean;
          level: number;
          my_status: Database['public']['Enums']['participant_status'];
          organizer_avatar_path: string;
          organizer_id: string;
          organizer_is_verified: boolean;
          organizer_name: string;
          organizer_reliability: number;
          participants_preview: Json;
          series_id: string;
          series_weekdays: number[];
          sport_id: string;
          spots_left: number;
          spots_reserved: number;
          spots_taken: number;
          spots_total: number;
          starts_at: string;
          status: Database['public']['Enums']['event_status'];
          title: string;
          venue_address: string;
          venue_id: string;
          venue_kind: Database['public']['Enums']['venue_kind'];
          venue_lat: number;
          venue_lng: number;
          venue_name: string;
          visibility: Database['public']['Enums']['event_visibility'];
        }[];
      };
      event_participants_list: {
        Args: { p_event_id: string };
        Returns: {
          attended: boolean;
          avatar_path: string;
          display_name: string;
          is_organizer: boolean;
          is_verified: boolean;
          joined_at: string;
          level: number;
          reliability_score: number;
          status: Database['public']['Enums']['participant_status'];
          user_id: string;
        }[];
      };
      events_feed: {
        Args: {
          p_cursor_id?: string;
          p_cursor_starts_at?: string;
          p_date_range?: string;
          p_district_key?: string;
          p_lat?: number;
          p_limit?: number;
          p_lng?: number;
          p_only_with_spots?: boolean;
          p_radius_km?: number;
          p_sport_ids?: string[];
          p_venue_id?: string;
        };
        Returns: {
          distance_km: number;
          district_key: string;
          ends_at: string;
          id: string;
          is_organizer: boolean;
          level: number;
          my_status: Database['public']['Enums']['participant_status'];
          organizer_avatar_path: string;
          organizer_id: string;
          organizer_is_verified: boolean;
          organizer_name: string;
          organizer_reliability: number;
          participants_preview: Json;
          series_id: string;
          sport_id: string;
          spots_left: number;
          spots_reserved: number;
          spots_taken: number;
          spots_total: number;
          starts_at: string;
          status: Database['public']['Enums']['event_status'];
          title: string;
          venue_id: string;
          venue_kind: Database['public']['Enums']['venue_kind'];
          venue_lat: number;
          venue_lng: number;
          venue_name: string;
          visibility: Database['public']['Enums']['event_visibility'];
        }[];
      };
      get_or_create_event_conversation: { Args: { p_event_id: string }; Returns: string };
      join_event: {
        Args: { p_event_id: string };
        Returns: {
          conversation_id: string;
          spots_reserved: number;
          spots_taken: number;
          spots_total: number;
        }[];
      };
      leave_event: { Args: { p_event_id: string }; Returns: undefined };
      mark_conversation_read: { Args: { p_conversation_id: string }; Returns: undefined };
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: undefined };
      match_candidates: {
        Args: { p_limit?: number; p_sport_id?: string };
        Returns: {
          avatar_path: string;
          bio: string;
          common_slots: string[];
          common_sport_ids: string[];
          display_name: string;
          distance_km_approx: number;
          district_key: string;
          goal: Database['public']['Enums']['user_goal'];
          is_verified: boolean;
          reliability_score: number;
          score: number;
          score_distance: number;
          score_level: number;
          score_schedule: number;
          score_sport: number;
          sport_ids: string[];
          sport_levels: number[];
          user_id: string;
        }[];
      };
      moderate_content: {
        Args: {
          p_status: Database['public']['Enums']['moderation_status'];
          p_target_id: string;
          p_target_type: Database['public']['Enums']['report_target'];
        };
        Returns: undefined;
      };
      my_conversations: {
        Args: Record<PropertyKey, never>;
        Returns: {
          avatar_path: string;
          conversation_id: string;
          event_id: string;
          event_starts_at: string;
          event_status: Database['public']['Enums']['event_status'];
          kind: Database['public']['Enums']['conversation_kind'];
          last_message_at: string;
          last_message_body: string;
          last_message_kind: Database['public']['Enums']['message_kind'];
          last_message_payload: Json;
          last_message_sender_id: string;
          match_id: string;
          muted: boolean;
          other_user_id: string;
          sport_id: string;
          title: string;
          unread_count: number;
        }[];
      };
      my_events: {
        Args: { p_limit?: number; p_scope?: string };
        Returns: {
          distance_km: number;
          district_key: string;
          ends_at: string;
          id: string;
          is_organizer: boolean;
          level: number;
          my_status: Database['public']['Enums']['participant_status'];
          organizer_avatar_path: string;
          organizer_id: string;
          organizer_is_verified: boolean;
          organizer_name: string;
          organizer_reliability: number;
          participants_preview: Json;
          series_id: string;
          sport_id: string;
          spots_left: number;
          spots_reserved: number;
          spots_taken: number;
          spots_total: number;
          starts_at: string;
          status: Database['public']['Enums']['event_status'];
          title: string;
          venue_id: string;
          venue_kind: Database['public']['Enums']['venue_kind'];
          venue_lat: number;
          venue_lng: number;
          venue_name: string;
          visibility: Database['public']['Enums']['event_visibility'];
        }[];
      };
      person_summary: {
        Args: { p_user_id: string };
        Returns: {
          attended_count: number;
          avatar_path: string;
          bio: string;
          common_slots: string[];
          common_sport_ids: string[];
          conversation_id: string;
          display_name: string;
          distance_km_approx: number;
          district_key: string;
          goal: Database['public']['Enums']['user_goal'];
          is_me: boolean;
          is_verified: boolean;
          match_id: string;
          reliability_score: number;
          sport_ids: string[];
          sport_levels: number[];
          user_id: string;
        }[];
      };
      propose_meeting: {
        Args: {
          p_duration_min?: number;
          p_match_id: string;
          p_note?: string;
          p_sport_id: string;
          p_starts_at: string;
          p_venue_id: string;
        };
        Returns: {
          conversation_id: string;
          event_id: string;
        }[];
      };
      register_push_token: {
        Args: { p_platform: Database['public']['Enums']['push_platform']; p_token: string };
        Returns: undefined;
      };
      remove_participant: { Args: { p_event_id: string; p_user_id: string }; Returns: undefined };
      review_venue_edit: { Args: { p_approve: boolean; p_edit_id: string }; Returns: undefined };
      set_availability: { Args: { p_slots: Json }; Returns: undefined };
      set_conversation_muted: {
        Args: { p_conversation_id: string; p_muted: boolean };
        Returns: undefined;
      };
      set_home_location: {
        Args: { p_lat: number; p_lng: number };
        Returns: {
          district_key: string;
        }[];
      };
      set_user_sports: { Args: { p_sports: Json }; Returns: undefined };
      set_user_verified: { Args: { p_user_id: string; p_verified: boolean }; Returns: undefined };
      submit_attendance: { Args: { p_event_id: string; p_marks: Json }; Returns: undefined };
      submit_report: {
        Args: {
          p_details?: string;
          p_reason: Database['public']['Enums']['report_reason'];
          p_target_id: string;
          p_target_type: Database['public']['Enums']['report_target'];
        };
        Returns: string;
      };
      suggest_venue_edit: {
        Args: {
          p_comment?: string;
          p_kind: Database['public']['Enums']['venue_edit_kind'];
          p_proposed: Json;
          p_venue_id: string;
        };
        Returns: string;
      };
      swipe: {
        Args: { p_liked: boolean; p_sport_id?: string; p_target_id: string };
        Returns: {
          conversation_id: string;
          match_id: string;
        }[];
      };
      unblock_user: { Args: { p_user_id: string }; Returns: undefined };
      unmatch: { Args: { p_match_id: string }; Returns: undefined };
      unregister_push_token: { Args: { p_token: string }; Returns: undefined };
      venue_detail: {
        Args: { p_venue_id: string };
        Returns: {
          access: string;
          address: string;
          created_at: string;
          district_key: string;
          flags: string[];
          has_pending_edit_by_me: boolean;
          id: string;
          is_free: boolean;
          is_indoor: boolean;
          is_lit: boolean;
          is_mine: boolean;
          is_mock: boolean;
          kind: Database['public']['Enums']['venue_kind'];
          lat: number;
          lng: number;
          name: string;
          opening_hours: string;
          osm_id: number;
          osm_type: string;
          phone: string;
          photo_count: number;
          source: Database['public']['Enums']['venue_source'];
          sport_ids: string[];
          status: Database['public']['Enums']['moderation_status'];
          surface: string;
          upcoming_events_count: number;
          updated_at: string;
          website: string;
        }[];
      };
      venue_photos_list: {
        Args: { p_venue_id: string };
        Returns: {
          attribution: string;
          created_at: string;
          external_url: string;
          id: string;
          is_mine: boolean;
          storage_path: string;
        }[];
      };
      venues_in_bbox: {
        Args: {
          p_limit?: number;
          p_max_lat: number;
          p_max_lng: number;
          p_min_lat: number;
          p_min_lng: number;
          p_sport_ids?: string[];
        };
        Returns: {
          district_key: string;
          id: string;
          is_free: boolean;
          is_lit: boolean;
          kind: Database['public']['Enums']['venue_kind'];
          lat: number;
          lng: number;
          name: string;
          sport_ids: string[];
          surface: string;
          today_events_count: number;
          upcoming_events_count: number;
        }[];
      };
    };
    Enums: {
      conversation_kind: 'event' | 'match';
      day_part: 'morning' | 'afternoon' | 'evening';
      edit_status: 'pending' | 'approved' | 'rejected';
      event_status: 'scheduled' | 'cancelled' | 'completed';
      event_visibility: 'public' | 'private';
      match_status: 'active' | 'unmatched';
      message_kind: 'text' | 'system' | 'event_invite';
      moderation_status: 'active' | 'pending' | 'hidden';
      notification_type:
        | 'event_nearby'
        | 'event_joined'
        | 'event_cancelled'
        | 'event_invite'
        | 'match'
        | 'message'
        | 'attendance_reminder';
      participant_status: 'invited' | 'going' | 'left' | 'removed';
      push_platform: 'ios' | 'android';
      push_status: 'pending' | 'sending' | 'sent' | 'skipped' | 'failed';
      report_reason:
        'spam' | 'abuse' | 'fake' | 'no_show' | 'inappropriate' | 'wrong_info' | 'other';
      report_status: 'open' | 'reviewed' | 'dismissed';
      report_target: 'user' | 'event' | 'venue' | 'venue_photo' | 'message';
      run_source: 'manual' | 'strava' | 'apple_health' | 'google_fit';
      user_goal: 'fun' | 'fitness' | 'competition' | 'learning';
      venue_edit_kind: 'create' | 'update' | 'close';
      venue_kind:
        | 'pitch'
        | 'sports_centre'
        | 'swimming_pool'
        | 'fitness_station'
        | 'track'
        | 'running_route'
        | 'other';
      venue_source: 'osm' | 'user';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      conversation_kind: ['event', 'match'],
      day_part: ['morning', 'afternoon', 'evening'],
      edit_status: ['pending', 'approved', 'rejected'],
      event_status: ['scheduled', 'cancelled', 'completed'],
      event_visibility: ['public', 'private'],
      match_status: ['active', 'unmatched'],
      message_kind: ['text', 'system', 'event_invite'],
      moderation_status: ['active', 'pending', 'hidden'],
      notification_type: [
        'event_nearby',
        'event_joined',
        'event_cancelled',
        'event_invite',
        'match',
        'message',
        'attendance_reminder',
      ],
      participant_status: ['invited', 'going', 'left', 'removed'],
      push_platform: ['ios', 'android'],
      push_status: ['pending', 'sending', 'sent', 'skipped', 'failed'],
      report_reason: ['spam', 'abuse', 'fake', 'no_show', 'inappropriate', 'wrong_info', 'other'],
      report_status: ['open', 'reviewed', 'dismissed'],
      report_target: ['user', 'event', 'venue', 'venue_photo', 'message'],
      run_source: ['manual', 'strava', 'apple_health', 'google_fit'],
      user_goal: ['fun', 'fitness', 'competition', 'learning'],
      venue_edit_kind: ['create', 'update', 'close'],
      venue_kind: [
        'pitch',
        'sports_centre',
        'swimming_pool',
        'fitness_station',
        'track',
        'running_route',
        'other',
      ],
      venue_source: ['osm', 'user'],
    },
  },
} as const;
