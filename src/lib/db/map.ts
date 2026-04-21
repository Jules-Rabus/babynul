// Adaptateurs Prisma (camelCase) ↔ shape API snake_case.

import type {
  Player,
  Team,
  Match,
  PlaySession,
  SessionPlayer,
  VoicePromptConfig,
  ProposedMatch,
  Wager,
} from "@prisma/client";
import type {
  PlayerRow,
  TeamRow,
  MatchRow,
  PlaySessionRow,
  SessionPlayerRow,
  VoicePromptConfigRow,
} from "./types";

const iso = (d: Date) => d.toISOString();

export function toPlayerRow(p: Player): PlayerRow {
  return {
    id: p.id,
    auth_user_id: p.authUserId,
    first_name: p.firstName,
    nickname: p.nickname,
    elo: p.elo,
    games_played: p.gamesPlayed,
    wager_balance: p.wagerBalance,
    wager_total_won: p.wagerTotalWon,
    wager_total_lost: p.wagerTotalLost,
    wager_bets_placed: p.wagerBetsPlaced,
    wager_bets_won: p.wagerBetsWon,
    created_at: iso(p.createdAt),
  };
}

export function toTeamRow(t: Team): TeamRow {
  return {
    id: t.id,
    player1_id: t.player1Id,
    player2_id: t.player2Id,
    elo: t.elo,
    games_played: t.gamesPlayed,
    created_at: iso(t.createdAt),
  };
}

export function toMatchRow(m: Match): MatchRow {
  return {
    id: m.id,
    mode: m.mode as "individual" | "team",
    team_a_id: m.teamAId,
    team_b_id: m.teamBId,
    player_a1_id: m.playerA1Id,
    player_a2_id: m.playerA2Id,
    player_b1_id: m.playerB1Id,
    player_b2_id: m.playerB2Id,
    score_a: m.scoreA,
    score_b: m.scoreB,
    winner_side: m.winnerSide as "A" | "B",
    elo_delta_a: m.eloDeltaA,
    elo_delta_b: m.eloDeltaB,
    team_elo_delta_a: m.teamEloDeltaA,
    team_elo_delta_b: m.teamEloDeltaB,
    played_at: iso(m.playedAt),
    recorded_by: m.recordedBy,
    session_id: m.sessionId,
  };
}

export function toPlaySessionRow(s: PlaySession): PlaySessionRow {
  return {
    id: s.id,
    label: s.label,
    status: s.status as "active" | "ended",
    started_at: iso(s.startedAt),
    ended_at: s.endedAt ? iso(s.endedAt) : null,
  };
}

export function toSessionPlayerRow(sp: SessionPlayer): SessionPlayerRow {
  return {
    session_id: sp.sessionId,
    player_id: sp.playerId,
    is_present: sp.isPresent,
    joined_at: iso(sp.joinedAt),
    left_at: sp.leftAt ? iso(sp.leftAt) : null,
  };
}

export function toVoicePromptConfigRow(v: VoicePromptConfig): VoicePromptConfigRow {
  return {
    id: v.id,
    intro: v.intro,
    goat_template: v.goatTemplate,
    roast_template: v.roastTemplate,
    mixed_template: v.mixedTemplate,
    updated_at: iso(v.updatedAt),
  };
}

export type ProposedMatchRowOut = {
  id: string;
  mode: "individual" | "team";
  team_a_p1: string;
  team_a_p2: string | null;
  team_b_p1: string;
  team_b_p2: string | null;
  elo_a: number;
  elo_b: number;
  match_id: string | null;
  status: "open" | "resolved" | "cancelled";
  winner_side: "A" | "B" | null;
  created_at: string;
  resolved_at: string | null;
  session_id: string | null;
};

export function toProposedMatchRow(p: ProposedMatch): ProposedMatchRowOut {
  return {
    id: p.id,
    mode: p.mode as "individual" | "team",
    team_a_p1: p.teamAP1,
    team_a_p2: p.teamAP2,
    team_b_p1: p.teamBP1,
    team_b_p2: p.teamBP2,
    elo_a: p.eloA,
    elo_b: p.eloB,
    match_id: p.matchId,
    status: p.status as "open" | "resolved" | "cancelled",
    winner_side: p.winnerSide as "A" | "B" | null,
    created_at: iso(p.createdAt),
    resolved_at: p.resolvedAt ? iso(p.resolvedAt) : null,
    session_id: p.sessionId,
  };
}

export type WagerRowOut = {
  id: string;
  proposed_match_id: string;
  player_id: string;
  side: "A" | "B";
  stake: number;
  odds: number;
  payout: number | null;
  status: "pending" | "won" | "lost" | "refunded";
  created_at: string;
};

export function toWagerRow(w: Wager): WagerRowOut {
  return {
    id: w.id,
    proposed_match_id: w.proposedMatchId,
    player_id: w.playerId,
    side: w.side as "A" | "B",
    stake: w.stake,
    odds: Number(w.odds),
    payout: w.payout,
    status: w.status as "pending" | "won" | "lost" | "refunded",
    created_at: iso(w.createdAt),
  };
}
