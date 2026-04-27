import type { TournamentWithGraph } from "@/lib/db/types";
import { displayName } from "@/lib/player-display";

export type TournamentParticipantView = {
  slot: number;
  label: string;
  elo: number;
  playerIds: string[];
};

export type TournamentMatchView = {
  id: string;
  round: number;
  slot: number;
  status: "pending" | "ready" | "played" | "bye";
  sideA: TournamentParticipantView | null;
  sideB: TournamentParticipantView | null;
  winner: TournamentParticipantView | null;
};

export type TournamentView = {
  id: string;
  label: string | null;
  mode: "individual" | "team";
  size: number;
  rounds: number;
  targetScore: number;
  status: "active" | "ended";
  startedAt: string;
  endedAt: string | null;
  sessionId: string | null;
  participants: Map<number, TournamentParticipantView>;
  matchesByRound: Map<number, TournamentMatchView[]>;
  champion: TournamentParticipantView | null;
};

const roundLabels: Record<number, string> = {
  1: "Finale",
  2: "Demi-finales",
  3: "Quarts de finale",
  4: "Huitièmes",
  5: "Seizièmes",
};

export function roundLabel(round: number): string {
  return roundLabels[round] ?? `Tour ${round}`;
}

/** Transforme le payload API en une vue ergonomique pour le bracket UI. */
export function toTournamentView(data: TournamentWithGraph): TournamentView {
  const participants = new Map<number, TournamentParticipantView>();
  for (const p of data.participants) {
    if (data.tournament.mode === "individual") {
      const pl = p.player;
      const label = p.label ?? (pl ? displayName(pl) : "?");
      participants.set(p.slot, {
        slot: p.slot,
        label,
        elo: pl?.elo ?? 1000,
        playerIds: pl ? [pl.id] : [],
      });
    } else {
      const p1 = p.team_p1;
      const p2 = p.team_p2;
      const label =
        p.label ??
        `${p1 ? displayName(p1) : "?"} & ${p2 ? displayName(p2) : "?"}`;
      const elo = Math.round(((p1?.elo ?? 1000) + (p2?.elo ?? 1000)) / 2);
      participants.set(p.slot, {
        slot: p.slot,
        label,
        elo,
        playerIds: [p1?.id, p2?.id].filter((x): x is string => !!x),
      });
    }
  }

  const matchesByRound = new Map<number, TournamentMatchView[]>();
  for (const m of data.matches) {
    const view: TournamentMatchView = {
      id: m.id,
      round: m.round,
      slot: m.slot,
      status: m.status,
      sideA: m.side_a_slot != null ? participants.get(m.side_a_slot) ?? null : null,
      sideB: m.side_b_slot != null ? participants.get(m.side_b_slot) ?? null : null,
      winner: m.winner_slot != null ? participants.get(m.winner_slot) ?? null : null,
    };
    const list = matchesByRound.get(m.round) ?? [];
    list.push(view);
    matchesByRound.set(m.round, list);
  }
  for (const list of matchesByRound.values()) {
    list.sort((a, b) => a.slot - b.slot);
  }

  const champion =
    data.tournament.status === "ended" && data.tournament.champion_player_id
      ? [...participants.values()].find((p) =>
          p.playerIds.includes(data.tournament.champion_player_id as string),
        ) ?? null
      : null;

  return {
    id: data.tournament.id,
    label: data.tournament.label,
    mode: data.tournament.mode,
    size: data.tournament.size,
    rounds: data.tournament.rounds,
    targetScore: data.tournament.target_score,
    status: data.tournament.status,
    startedAt: data.tournament.started_at,
    endedAt: data.tournament.ended_at,
    sessionId: data.tournament.session_id,
    participants,
    matchesByRound,
    champion,
  };
}
