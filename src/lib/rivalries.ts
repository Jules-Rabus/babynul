import type { MatchRow, PlayerRow } from "@/lib/supabase/types";

export type RivalryPlayer = Pick<PlayerRow, "id" | "first_name" | "elo">;

export type Rivalry = {
  key: string;
  kind: "revanche" | "belle" | "rivalite";
  mode: "individual" | "team";
  // On présente toujours l'équipe "en retard" du côté A pour le libellé
  teamA: RivalryPlayer[];
  teamB: RivalryPlayer[];
  winsA: number;
  winsB: number;
  lastPlayedAt: string;
};

function canonicalTeamKey(ids: string[]): string {
  return [...ids].sort().join("|");
}

function matchKey(mode: "individual" | "team", teamAIds: string[], teamBIds: string[]) {
  const a = canonicalTeamKey(teamAIds);
  const b = canonicalTeamKey(teamBIds);
  const [first, second] = a < b ? [a, b] : [b, a];
  return `${mode}:${first}:${second}`;
}

/**
 * Calcule les suggestions de revanche/belle/rivalité à partir de l'historique.
 * Ne garde que les matchs des 30 derniers jours avec des joueurs présents aujourd'hui.
 */
export function detectRivalries(
  matches: MatchRow[],
  presentPlayers: RivalryPlayer[],
): Rivalry[] {
  const byId = new Map(presentPlayers.map((p) => [p.id, p]));
  const presentIds = new Set(presentPlayers.map((p) => p.id));
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  type Agg = {
    mode: "individual" | "team";
    teamA: string[];
    teamB: string[];
    winsA: number;
    winsB: number;
    lastPlayedAt: string;
  };
  const acc = new Map<string, Agg>();

  for (const m of matches) {
    if (new Date(m.played_at).getTime() < thirtyDaysAgo) continue;

    const rawA = m.mode === "individual"
      ? [m.player_a1_id]
      : [m.player_a1_id, m.player_a2_id];
    const rawB = m.mode === "individual"
      ? [m.player_b1_id]
      : [m.player_b1_id, m.player_b2_id];
    const aIds = rawA.filter((x): x is string => !!x);
    const bIds = rawB.filter((x): x is string => !!x);
    if (aIds.length === 0 || bIds.length === 0) continue;
    // Ignorer si tous les joueurs ne sont pas présents aujourd'hui
    if (![...aIds, ...bIds].every((id) => presentIds.has(id))) continue;

    const canonicalA = canonicalTeamKey(aIds);
    const canonicalB = canonicalTeamKey(bIds);
    const swapped = canonicalA > canonicalB;
    const normTeamA = swapped ? bIds : aIds;
    const normTeamB = swapped ? aIds : bIds;
    const winA = swapped ? m.winner_side === "B" : m.winner_side === "A";

    const key = matchKey(m.mode, aIds, bIds);
    const current = acc.get(key) ?? {
      mode: m.mode,
      teamA: normTeamA,
      teamB: normTeamB,
      winsA: 0,
      winsB: 0,
      lastPlayedAt: m.played_at,
    };
    if (winA) current.winsA++; else current.winsB++;
    if (new Date(m.played_at) > new Date(current.lastPlayedAt)) {
      current.lastPlayedAt = m.played_at;
    }
    acc.set(key, current);
  }

  const result: Rivalry[] = [];
  for (const [key, agg] of acc) {
    const total = agg.winsA + agg.winsB;
    if (total < 1) continue;

    // L'équipe "en retard" passe côté A du libellé (pour la revanche)
    let A = agg.teamA, B = agg.teamB, winsA = agg.winsA, winsB = agg.winsB;
    if (winsA > winsB) {
      [A, B] = [B, A];
      [winsA, winsB] = [winsB, winsA];
    }

    const teamA = A.map((id) => byId.get(id)).filter((p): p is RivalryPlayer => !!p);
    const teamB = B.map((id) => byId.get(id)).filter((p): p is RivalryPlayer => !!p);
    if (teamA.length !== A.length || teamB.length !== B.length) continue;

    let kind: Rivalry["kind"];
    if (winsA === winsB) kind = "belle";
    else if (total >= 3) kind = "rivalite";
    else kind = "revanche";

    result.push({
      key,
      kind,
      mode: agg.mode,
      teamA,
      teamB,
      winsA,
      winsB,
      lastPlayedAt: agg.lastPlayedAt,
    });
  }

  // Priorité : belle > revanche > rivalite, puis date récente
  const priority: Record<Rivalry["kind"], number> = { belle: 0, revanche: 1, rivalite: 2 };
  result.sort((a, b) => {
    if (priority[a.kind] !== priority[b.kind]) return priority[a.kind] - priority[b.kind];
    return new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime();
  });

  return result;
}

export function rivalryLabel(r: Rivalry): string {
  switch (r.kind) {
    case "belle":
      return `Belle (${r.winsA}-${r.winsB})`;
    case "revanche":
      return `Revanche (${r.winsA}-${r.winsB})`;
    case "rivalite":
      return `Rivalité (${r.winsA}-${r.winsB})`;
  }
}
