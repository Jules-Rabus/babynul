// Types minimaux compatibles avec @supabase/supabase-js v2
// (remplaçables par `supabase gen types typescript`)

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      players: {
        Row: {
          id: string;
          auth_user_id: string | null;
          first_name: string;
          elo: number;
          games_played: number;
          wager_balance: number;
          wager_total_won: number;
          wager_total_lost: number;
          wager_bets_placed: number;
          wager_bets_won: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          first_name: string;
          elo?: number;
          games_played?: number;
          wager_balance?: number;
          wager_total_won?: number;
          wager_total_lost?: number;
          wager_bets_placed?: number;
          wager_bets_won?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string | null;
          first_name?: string;
          elo?: number;
          games_played?: number;
          wager_balance?: number;
          wager_total_won?: number;
          wager_total_lost?: number;
          wager_bets_placed?: number;
          wager_bets_won?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          player1_id: string;
          player2_id: string;
          elo: number;
          games_played: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          player1_id: string;
          player2_id: string;
          elo?: number;
          games_played?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          player1_id?: string;
          player2_id?: string;
          elo?: number;
          games_played?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          mode: "individual" | "team";
          team_a_id: string | null;
          team_b_id: string | null;
          player_a1_id: string | null;
          player_a2_id: string | null;
          player_b1_id: string | null;
          player_b2_id: string | null;
          score_a: number;
          score_b: number;
          winner_side: "A" | "B";
          elo_delta_a: number;
          elo_delta_b: number;
          team_elo_delta_a: number | null;
          team_elo_delta_b: number | null;
          played_at: string;
          recorded_by: string | null;
        };
        Insert: {
          id?: string;
          mode: "individual" | "team";
          team_a_id?: string | null;
          team_b_id?: string | null;
          player_a1_id?: string | null;
          player_a2_id?: string | null;
          player_b1_id?: string | null;
          player_b2_id?: string | null;
          score_a: number;
          score_b: number;
          winner_side: "A" | "B";
          elo_delta_a?: number;
          elo_delta_b?: number;
          team_elo_delta_a?: number | null;
          team_elo_delta_b?: number | null;
          played_at?: string;
          recorded_by?: string | null;
        };
        Update: {
          id?: string;
          mode?: "individual" | "team";
          team_a_id?: string | null;
          team_b_id?: string | null;
          player_a1_id?: string | null;
          player_a2_id?: string | null;
          player_b1_id?: string | null;
          player_b2_id?: string | null;
          score_a?: number;
          score_b?: number;
          winner_side?: "A" | "B";
          elo_delta_a?: number;
          elo_delta_b?: number;
          team_elo_delta_a?: number | null;
          team_elo_delta_b?: number | null;
          played_at?: string;
          recorded_by?: string | null;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      record_match: {
        Args: Record<string, unknown>;
        Returns: string;
      };
      delete_player_cascade: {
        Args: Record<string, unknown>;
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
export type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
export type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
