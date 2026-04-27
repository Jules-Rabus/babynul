export type DemoPlayer = {
  id: string;
  first_name: string;
  nickname: string | null;
  elo: number;
  games_played: number;
};

export type DemoMatch = {
  id: string;
  teamA: string[];
  teamB: string[];
  score_a: number;
  score_b: number;
  winner_side: "A" | "B";
  played_at: string;
  /** Lie le match à la session mock (si défini) — sert au mode Roast/GOAT. */
  session_id?: string | null;
};

export const DEMO_PLAYERS: DemoPlayer[] = [
  { id: "p1", first_name: "Jules", nickname: "Le Boss", elo: 1240, games_played: 42 },
  { id: "p2", first_name: "Marie", nickname: "La Machine", elo: 1205, games_played: 38 },
  { id: "p3", first_name: "Nico", nickname: null, elo: 1180, games_played: 31 },
  { id: "p4", first_name: "Léa", nickname: "Sniper", elo: 1172, games_played: 29 },
  { id: "p5", first_name: "Tom", nickname: "Le Goat", elo: 1160, games_played: 27 },
  { id: "p6", first_name: "Sarah", nickname: null, elo: 1085, games_played: 20 },
  { id: "p7", first_name: "Alex", nickname: "Zizou", elo: 1060, games_played: 18 },
  { id: "p8", first_name: "Emma", nickname: null, elo: 1020, games_played: 14 },
  { id: "p9", first_name: "Raph", nickname: "Le Poulain", elo: 985, games_played: 9 },
  { id: "p10", first_name: "Clara", nickname: null, elo: 960, games_played: 7 },
  { id: "p11", first_name: "Max", nickname: "Le Rookie", elo: 940, games_played: 5 },
  { id: "p12", first_name: "Inès", nickname: null, elo: 905, games_played: 3 },
];

const now = Date.now();
const iso = (daysAgo: number, minutesAgo = 0) =>
  new Date(now - daysAgo * 86400000 - minutesAgo * 60000).toISOString();

export const DEMO_SESSION_ID = "s-demo";

/**
 * Matchs de la session en cours (session_id = DEMO_SESSION_ID).
 * Structure conçue pour déclencher Roast/GOAT dans le voice mode :
 *  - p1 (Jules / Le Boss) : 3 victoires d'affilée → mode GOAT 🐐
 *  - p12 (Inès) : 3 défaites d'affilée → mode ROAST 💀
 */
const sessionMatches: DemoMatch[] = [
  // Plus récent → en haut. Trois victoires consécutives pour p1 (GOAT).
  {
    id: "s-m1",
    teamA: ["p1", "p5"],
    teamB: ["p3", "p8"],
    score_a: 10,
    score_b: 6,
    winner_side: "A",
    played_at: iso(0, 10),
    session_id: DEMO_SESSION_ID,
  },
  {
    id: "s-m2",
    teamA: ["p1", "p7"],
    teamB: ["p2", "p4"],
    score_a: 10,
    score_b: 8,
    winner_side: "A",
    played_at: iso(0, 35),
    session_id: DEMO_SESSION_ID,
  },
  {
    id: "s-m3",
    teamA: ["p1", "p6"],
    teamB: ["p9", "p11"],
    score_a: 10,
    score_b: 4,
    winner_side: "A",
    played_at: iso(0, 65),
    session_id: DEMO_SESSION_ID,
  },
  // Trois défaites consécutives pour p12 (ROAST). Plus récentes → en haut des siens.
  {
    id: "s-m4",
    teamA: ["p2", "p3"],
    teamB: ["p12", "p10"],
    score_a: 10,
    score_b: 3,
    winner_side: "A",
    played_at: iso(0, 25),
    session_id: DEMO_SESSION_ID,
  },
  {
    id: "s-m5",
    teamA: ["p4", "p8"],
    teamB: ["p12", "p9"],
    score_a: 10,
    score_b: 5,
    winner_side: "A",
    played_at: iso(0, 55),
    session_id: DEMO_SESSION_ID,
  },
  {
    id: "s-m6",
    teamA: ["p5", "p7"],
    teamB: ["p12", "p11"],
    score_a: 10,
    score_b: 7,
    winner_side: "A",
    played_at: iso(0, 85),
    session_id: DEMO_SESSION_ID,
  },
];

/** Matchs plus anciens, hors session, juste pour garnir l'historique public. */
const historicalMatches: DemoMatch[] = [
  { id: "h-m1", teamA: ["p1"], teamB: ["p2"], score_a: 10, score_b: 8, winner_side: "A", played_at: iso(1) },
  { id: "h-m2", teamA: ["p3"], teamB: ["p5"], score_a: 7, score_b: 10, winner_side: "B", played_at: iso(1, 90) },
  { id: "h-m3", teamA: ["p9"], teamB: ["p12"], score_a: 10, score_b: 2, winner_side: "A", played_at: iso(2) },
  { id: "h-m4", teamA: ["p4"], teamB: ["p10"], score_a: 10, score_b: 4, winner_side: "A", played_at: iso(3) },
];

export const DEMO_MATCHES: DemoMatch[] = [...sessionMatches, ...historicalMatches];

export const DEMO_SESSION = {
  id: DEMO_SESSION_ID,
  label: `Partie du ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long" })}`,
  started_at: iso(0, 120),
  // Les 12 sont présents dans la session mock — p1 a 3 victoires, p12 a 3 défaites.
  participants: DEMO_PLAYERS,
  target_score: 10,
};
