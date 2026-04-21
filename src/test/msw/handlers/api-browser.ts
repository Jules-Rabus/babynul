"use client";
/**
 * Handlers MSW navigateur : interceptent les endpoints /api/* Next.js.
 * Les Server Actions (POST /) restent non interceptées → elles iront vers
 * Next.js qui les exécute avec Prisma. En mode mock, utilise aussi une
 * DATABASE_URL factice et ça plantera côté action : le but du mock est de
 * tester l'UI sans BDD, donc les mutations sont no-op en local.
 */

import { http, HttpResponse, type HttpHandler } from "msw";
import {
  DEMO_PLAYERS,
  DEMO_MATCHES,
  DEMO_SESSION,
  DEMO_SESSION_ID,
} from "@/lib/demo/fixtures";

type Row = Record<string, unknown>;

type State = {
  players: Row[];
  matches: Row[];
  teams: Row[];
  proposed_matches: Row[];
  wagers: Row[];
  play_sessions: Row[];
  session_players: Row[];
};

function seed(): State {
  const players: Row[] = DEMO_PLAYERS.map((p) => ({
    id: p.id,
    auth_user_id: null,
    first_name: p.first_name,
    nickname: p.nickname,
    elo: p.elo,
    games_played: p.games_played,
    wager_balance: 1000 + Math.floor(Math.random() * 500),
    wager_total_won: 0,
    wager_total_lost: 0,
    wager_bets_placed: 0,
    wager_bets_won: 0,
    created_at: new Date().toISOString(),
  }));

  const matches: Row[] = DEMO_MATCHES.map((m) => {
    const isTeam = m.teamA.length === 2 && m.teamB.length === 2;
    return {
      id: m.id,
      mode: isTeam ? "team" : "individual",
      team_a_id: null,
      team_b_id: null,
      player_a1_id: m.teamA[0] ?? null,
      player_a2_id: m.teamA[1] ?? null,
      player_b1_id: m.teamB[0] ?? null,
      player_b2_id: m.teamB[1] ?? null,
      score_a: m.score_a,
      score_b: m.score_b,
      winner_side: m.winner_side,
      elo_delta_a: 10,
      elo_delta_b: -10,
      team_elo_delta_a: null,
      team_elo_delta_b: null,
      played_at: m.played_at,
      recorded_by: null,
      session_id: m.session_id ?? null,
    };
  });

  const play_sessions: Row[] = [
    {
      id: DEMO_SESSION_ID,
      label: DEMO_SESSION.label,
      status: "active",
      started_at: DEMO_SESSION.started_at,
      ended_at: null,
    },
  ];

  const session_players: Row[] = DEMO_SESSION.participants.map((p) => ({
    session_id: DEMO_SESSION_ID,
    player_id: p.id,
    is_present: true,
    joined_at: DEMO_SESSION.started_at,
    left_at: null,
  }));

  return {
    players,
    matches,
    teams: [],
    proposed_matches: [],
    wagers: [],
    play_sessions,
    session_players,
  };
}

const state: State = seed();

function playerById(id: string | null | undefined) {
  if (!id) return null;
  const p = state.players.find((x) => x.id === id);
  return p
    ? {
        id: p.id,
        first_name: p.first_name,
        nickname: p.nickname,
        elo: p.elo,
        games_played: p.games_played,
      }
    : null;
}

export function makeHandlers(): HttpHandler[] {
  return [
    // GET /api/players
    http.get("/api/players", () => HttpResponse.json(state.players)),

    // GET /api/teams
    http.get("/api/teams", () => HttpResponse.json(state.teams)),

    // GET /api/matches?scope=recent|player|session
    http.get("/api/matches", ({ request }) => {
      const url = new URL(request.url);
      const scope = url.searchParams.get("scope") ?? "recent";
      if (scope === "recent") {
        const days = Number(url.searchParams.get("days") ?? "30");
        const since = Date.now() - days * 86400000;
        return HttpResponse.json(
          state.matches.filter((m) => new Date(String(m.played_at)).getTime() >= since),
        );
      }
      if (scope === "player") {
        const pid = url.searchParams.get("playerId");
        return HttpResponse.json(
          state.matches.filter(
            (m) =>
              m.player_a1_id === pid ||
              m.player_a2_id === pid ||
              m.player_b1_id === pid ||
              m.player_b2_id === pid,
          ),
        );
      }
      // session
      const sid = url.searchParams.get("sessionId");
      return HttpResponse.json(state.matches.filter((m) => m.session_id === sid));
    }),

    // GET /api/sessions/active
    http.get("/api/sessions/active", () => {
      const active = state.play_sessions.find((s) => s.status === "active");
      if (!active) return HttpResponse.json(null);
      const participants = state.session_players
        .filter((sp) => sp.session_id === active.id)
        .map((sp) => ({
          session_id: sp.session_id,
          player_id: sp.player_id,
          is_present: sp.is_present,
          joined_at: sp.joined_at,
          left_at: sp.left_at,
          player: playerById(sp.player_id as string),
        }));
      return HttpResponse.json({ session: active, participants });
    }),

    // GET /api/proposed-matches?sessionId=?
    http.get("/api/proposed-matches", ({ request }) => {
      const url = new URL(request.url);
      const sid = url.searchParams.get("sessionId");
      const filtered = sid
        ? state.proposed_matches.filter((m) => m.session_id === sid)
        : state.proposed_matches;
      const out = filtered.map((m) => ({
        ...m,
        team_a_p1_player: playerById(m.team_a_p1 as string),
        team_a_p2_player: playerById(m.team_a_p2 as string | null),
        team_b_p1_player: playerById(m.team_b_p1 as string),
        team_b_p2_player: playerById(m.team_b_p2 as string | null),
      }));
      return HttpResponse.json(out);
    }),

    // GET /api/wagers?proposedMatchId=X
    http.get("/api/wagers", ({ request }) => {
      const url = new URL(request.url);
      const mid = url.searchParams.get("proposedMatchId");
      return HttpResponse.json(
        state.wagers.filter((w) => w.proposed_match_id === mid),
      );
    }),

    // GET /api/voice/config
    http.get("/api/voice/config", () =>
      HttpResponse.json({
        intro: "Tu es le commentateur officiel…",
        goat_template: "MODE GOAT : {names}…",
        roast_template: "MODE ROAST : {names}…",
        mixed_template: "Narration épique…",
      }),
    ),

    // POST /api/voice/announce et /api/voice/preview : pas de mock (besoin LLM + TTS)
    // → on bypass pour que les vraies clés API soient utilisées si présentes.
  ];
}
