// Shapes des rows telles qu'elles sont exposées par les endpoints /api/*.
// Colonnes en snake_case pour rester compatibles avec le code existant.
// (Prisma expose du camelCase en interne, on mappe côté endpoint.)

export type PlayerRow = {
  id: string;
  auth_user_id: string | null;
  first_name: string;
  nickname: string | null;
  elo: number;
  games_played: number;
  wager_balance: number;
  wager_total_won: number;
  wager_total_lost: number;
  wager_bets_placed: number;
  wager_bets_won: number;
  created_at: string;
};

export type TeamRow = {
  id: string;
  player1_id: string;
  player2_id: string;
  elo: number;
  games_played: number;
  created_at: string;
};

export type MatchRow = {
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
  session_id: string | null;
};

export type PlaySessionRow = {
  id: string;
  label: string | null;
  status: "active" | "ended";
  started_at: string;
  ended_at: string | null;
};

export type SessionPlayerRow = {
  session_id: string;
  player_id: string;
  is_present: boolean;
  joined_at: string;
  left_at: string | null;
};

export type VoicePromptConfigRow = {
  id: number;
  intro: string;
  goat_template: string;
  roast_template: string;
  mixed_template: string;
  updated_at: string;
};
