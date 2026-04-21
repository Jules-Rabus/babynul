import { http, HttpResponse } from "msw";
import { db } from "../db";

const SUPA = "https://demo.supabase.co/rest/v1";

export const supabaseHandlers = [
  http.get(`${SUPA}/players`, () => HttpResponse.json(db.state.players)),
  http.get(`${SUPA}/matches`, () => HttpResponse.json(db.state.matches)),
  http.get(`${SUPA}/play_sessions`, () => HttpResponse.json(db.state.sessions)),
  http.get(`${SUPA}/session_players`, () => HttpResponse.json(db.state.session_players)),

  http.post(`${SUPA}/rpc/record_match`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const id = `match-${db.state.matches.length + 1}`;
    db.state.matches.unshift({
      id,
      mode: body.p_mode as "individual" | "team",
      team_a_id: null,
      team_b_id: null,
      player_a1_id: body.p_a1 as string | null,
      player_a2_id: (body.p_a2 as string | null) ?? null,
      player_b1_id: body.p_b1 as string | null,
      player_b2_id: (body.p_b2 as string | null) ?? null,
      score_a: Number(body.p_score_a),
      score_b: Number(body.p_score_b),
      winner_side: Number(body.p_score_a) > Number(body.p_score_b) ? "A" : "B",
      elo_delta_a: 10,
      elo_delta_b: -10,
      team_elo_delta_a: null,
      team_elo_delta_b: null,
      played_at: new Date().toISOString(),
      recorded_by: null,
      session_id: null,
    });
    return HttpResponse.json(id);
  }),
];
