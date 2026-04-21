"use client";
/**
 * Handlers MSW navigateur : interceptent les appels au backend Supabase
 * pour permettre un mode 100% local sans BDD. Utilisé par npm run start:mock.
 *
 * On reste minimaliste : on intercepte les endpoints effectivement appelés
 * par l'app. Le parsing des query params Supabase est simplifié.
 */

import { http, HttpResponse, type HttpHandler } from "msw";
import { DEMO_PLAYERS, DEMO_MATCHES, DEMO_SESSION } from "@/lib/demo/fixtures";

type Row = Record<string, unknown>;

type BrowserState = {
  players: Row[];
  matches: Row[];
  teams: Row[];
  proposed_matches: Row[];
  wagers: Row[];
  play_sessions: Row[];
  session_players: Row[];
};

const uuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

function seed(): BrowserState {
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

  const matches: Row[] = DEMO_MATCHES.map((m) => ({
    id: m.id,
    mode: "individual",
    team_a_id: null,
    team_b_id: null,
    player_a1_id: m.teamA[0],
    player_a2_id: null,
    player_b1_id: m.teamB[0],
    player_b2_id: null,
    score_a: m.score_a,
    score_b: m.score_b,
    winner_side: m.winner_side,
    elo_delta_a: 10,
    elo_delta_b: -10,
    team_elo_delta_a: null,
    team_elo_delta_b: null,
    played_at: m.played_at,
    recorded_by: null,
    session_id: null,
  }));

  const sessionId = DEMO_SESSION.id;
  const play_sessions: Row[] = [
    {
      id: sessionId,
      label: DEMO_SESSION.label,
      status: "active",
      started_at: DEMO_SESSION.started_at,
      ended_at: null,
    },
  ];

  const session_players: Row[] = DEMO_SESSION.participants.map((p) => ({
    session_id: sessionId,
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

const state: BrowserState = seed();

function playerById(id: string | null | undefined) {
  if (!id) return null;
  return state.players.find((p) => p.id === id) ?? null;
}

/**
 * Parse la sélection Supabase `select=*, rel:table(col1,col2)` pour joindre
 * les joueurs aux proposed_matches. Approche très simplifiée.
 */
function expandProposedMatch(m: Row): Row {
  return {
    ...m,
    team_a_p1_player: playerById(m.team_a_p1 as string | null),
    team_a_p2_player: playerById(m.team_a_p2 as string | null),
    team_b_p1_player: playerById(m.team_b_p1 as string | null),
    team_b_p2_player: playerById(m.team_b_p2 as string | null),
  };
}

function expandTeam(t: Row): Row {
  return {
    ...t,
    player1: playerById(t.player1_id as string | null),
    player2: playerById(t.player2_id as string | null),
  };
}

function applyEqFilters(rows: Row[], url: URL): Row[] {
  const out: Row[] = [];
  const filters: Array<[string, unknown]> = [];
  for (const [key, value] of url.searchParams) {
    if (key === "select" || key === "order" || key === "limit") continue;
    // eq.X / gte.X etc.
    const [op, ...rest] = value.split(".");
    const rawVal = rest.join(".");
    if (op === "eq") filters.push([key, rawVal]);
    if (op === "gte") filters.push([`__gte__${key}`, rawVal]);
  }
  for (const r of rows) {
    let keep = true;
    for (const [k, v] of filters) {
      if (k.startsWith("__gte__")) {
        const col = k.replace("__gte__", "");
        if (!(String(r[col]) >= String(v))) keep = false;
      } else {
        if (String(r[k]) !== String(v)) keep = false;
      }
    }
    if (keep) out.push(r);
  }
  return out;
}

function getBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://mock.supabase.local";
  return url.replace(/\/$/, "");
}

export function makeHandlers(): HttpHandler[] {
  const base = getBaseUrl();
  const REST = `${base}/rest/v1`;

  return [
    // GET /players
    http.get(`${REST}/players`, ({ request }) => {
      const url = new URL(request.url);
      const filtered = applyEqFilters(state.players, url);
      return HttpResponse.json(filtered);
    }),

    // POST /players (insert)
    http.post(`${REST}/players`, async ({ request }) => {
      const body = (await request.json()) as Row | Row[];
      const rows = Array.isArray(body) ? body : [body];
      const created = rows.map((r) => ({
        id: (r.id as string) ?? uuid(),
        auth_user_id: null,
        first_name: r.first_name,
        nickname: (r.nickname as string | null) ?? null,
        elo: (r.elo as number) ?? 1000,
        games_played: 0,
        wager_balance: 1000,
        wager_total_won: 0,
        wager_total_lost: 0,
        wager_bets_placed: 0,
        wager_bets_won: 0,
        created_at: new Date().toISOString(),
      }));
      state.players.push(...created);
      return HttpResponse.json(created);
    }),

    // PATCH /players?id=eq.X (update)
    http.patch(`${REST}/players`, async ({ request }) => {
      const url = new URL(request.url);
      const body = (await request.json()) as Row;
      const targets = applyEqFilters(state.players, url);
      for (const t of targets) Object.assign(t, body);
      return HttpResponse.json(targets);
    }),

    // GET /matches
    http.get(`${REST}/matches`, ({ request }) => {
      const url = new URL(request.url);
      const filtered = applyEqFilters(state.matches, url);
      return HttpResponse.json(filtered);
    }),

    // GET /teams
    http.get(`${REST}/teams`, ({ request }) => {
      const url = new URL(request.url);
      const filtered = applyEqFilters(state.teams, url);
      return HttpResponse.json(filtered.map(expandTeam));
    }),

    // GET /proposed_matches
    http.get(`${REST}/proposed_matches`, ({ request }) => {
      const url = new URL(request.url);
      const filtered = applyEqFilters(state.proposed_matches, url);
      return HttpResponse.json(filtered.map(expandProposedMatch));
    }),

    // POST /proposed_matches (insert)
    http.post(`${REST}/proposed_matches`, async ({ request }) => {
      const body = (await request.json()) as Row | Row[];
      const rows = Array.isArray(body) ? body : [body];
      const created = rows.map((r) => ({
        id: uuid(),
        mode: r.mode,
        team_a_p1: r.team_a_p1,
        team_a_p2: r.team_a_p2 ?? null,
        team_b_p1: r.team_b_p1,
        team_b_p2: r.team_b_p2 ?? null,
        elo_a: r.elo_a,
        elo_b: r.elo_b,
        match_id: null,
        status: "open",
        winner_side: null,
        created_at: new Date().toISOString(),
        resolved_at: null,
        session_id: r.session_id ?? null,
      }));
      state.proposed_matches.push(...created);
      return HttpResponse.json(created);
    }),

    // GET /wagers
    http.get(`${REST}/wagers`, ({ request }) => {
      const url = new URL(request.url);
      const filtered = applyEqFilters(state.wagers, url);
      return HttpResponse.json(filtered);
    }),

    // GET /play_sessions
    http.get(`${REST}/play_sessions`, ({ request }) => {
      const url = new URL(request.url);
      const filtered = applyEqFilters(state.play_sessions, url);
      return HttpResponse.json(filtered);
    }),

    // GET /session_players
    http.get(`${REST}/session_players`, ({ request }) => {
      const url = new URL(request.url);
      const filtered = applyEqFilters(state.session_players, url).map((sp) => ({
        ...sp,
        player: playerById(sp.player_id as string),
      }));
      return HttpResponse.json(filtered);
    }),

    // POST /rpc/record_match, record_match_v2
    http.post(`${REST}/rpc/record_match`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(recordMatch(body));
    }),
    http.post(`${REST}/rpc/record_match_v2`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(recordMatch(body));
    }),

    // POST /rpc/start_play_session
    http.post(`${REST}/rpc/start_play_session`, async ({ request }) => {
      const body = (await request.json()) as { p_label?: string | null };
      for (const s of state.play_sessions) {
        if (s.status === "active") {
          s.status = "ended";
          s.ended_at = new Date().toISOString();
        }
      }
      const id = uuid();
      state.play_sessions.unshift({
        id,
        label: body.p_label ?? null,
        status: "active",
        started_at: new Date().toISOString(),
        ended_at: null,
      });
      return HttpResponse.json(id);
    }),

    http.post(`${REST}/rpc/end_play_session`, async ({ request }) => {
      const body = (await request.json()) as { p_session_id: string };
      const s = state.play_sessions.find((x) => x.id === body.p_session_id);
      if (s) {
        s.status = "ended";
        s.ended_at = new Date().toISOString();
      }
      return HttpResponse.json(null);
    }),

    http.post(`${REST}/rpc/set_session_presence`, async ({ request }) => {
      const body = (await request.json()) as {
        p_session_id: string;
        p_player_id: string;
        p_present: boolean;
      };
      const existing = state.session_players.find(
        (sp) =>
          sp.session_id === body.p_session_id && sp.player_id === body.p_player_id,
      );
      if (existing) {
        existing.is_present = body.p_present;
        existing.left_at = body.p_present ? null : new Date().toISOString();
      } else {
        state.session_players.push({
          session_id: body.p_session_id,
          player_id: body.p_player_id,
          is_present: body.p_present,
          joined_at: new Date().toISOString(),
          left_at: body.p_present ? null : new Date().toISOString(),
        });
      }
      return HttpResponse.json(null);
    }),

    http.post(`${REST}/rpc/cancel_open_matches_for_session`, async ({ request }) => {
      const body = (await request.json()) as {
        p_session_id: string;
        p_involving_player?: string | null;
      };
      let count = 0;
      for (const m of state.proposed_matches) {
        if (m.status !== "open" || m.session_id !== body.p_session_id) continue;
        if (body.p_involving_player) {
          const involved = [m.team_a_p1, m.team_a_p2, m.team_b_p1, m.team_b_p2].includes(
            body.p_involving_player,
          );
          if (!involved) continue;
        }
        m.status = "cancelled";
        count++;
      }
      return HttpResponse.json(count);
    }),

    http.post(`${REST}/rpc/cancel_proposed_match`, async ({ request }) => {
      const body = (await request.json()) as { p_proposed_match_id: string };
      const m = state.proposed_matches.find((x) => x.id === body.p_proposed_match_id);
      if (m) m.status = "cancelled";
      return HttpResponse.json(null);
    }),

    http.post(`${REST}/rpc/resolve_proposed_match`, async ({ request }) => {
      const body = (await request.json()) as {
        p_proposed_match_id: string;
        p_winner_side: "A" | "B";
        p_match_id?: string | null;
      };
      const m = state.proposed_matches.find((x) => x.id === body.p_proposed_match_id);
      if (m) {
        m.status = "resolved";
        m.winner_side = body.p_winner_side;
        m.match_id = body.p_match_id ?? null;
        m.resolved_at = new Date().toISOString();
      }
      return HttpResponse.json(null);
    }),

    http.post(`${REST}/rpc/place_wager`, async () => HttpResponse.json(uuid())),
    http.post(`${REST}/rpc/undo_last_match`, async () => HttpResponse.json(null)),
    http.post(`${REST}/rpc/delete_player_cascade`, async ({ request }) => {
      const body = (await request.json()) as { p_player_id: string };
      state.players = state.players.filter((p) => p.id !== body.p_player_id);
      return HttpResponse.json(null);
    }),
  ];

  function recordMatch(body: Record<string, unknown>) {
    const id = uuid();
    state.matches.unshift({
      id,
      mode: body.p_mode,
      team_a_id: null,
      team_b_id: null,
      player_a1_id: body.p_a1 ?? null,
      player_a2_id: body.p_a2 ?? null,
      player_b1_id: body.p_b1 ?? null,
      player_b2_id: body.p_b2 ?? null,
      score_a: Number(body.p_score_a),
      score_b: Number(body.p_score_b),
      winner_side: Number(body.p_score_a) > Number(body.p_score_b) ? "A" : "B",
      elo_delta_a: 10,
      elo_delta_b: -10,
      team_elo_delta_a: null,
      team_elo_delta_b: null,
      played_at: new Date().toISOString(),
      recorded_by: null,
      session_id: body.p_session_id ?? null,
    });
    return id;
  }
}
