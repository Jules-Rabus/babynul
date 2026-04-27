export type RealtimeEvent =
  | { type: "proposed-match:created"; sessionId: string | null }
  | { type: "proposed-match:cancelled"; sessionId: string | null }
  | { type: "match:recorded"; sessionId: string | null }
  | { type: "session:presence-changed"; sessionId: string }
  | { type: "session:started"; sessionId: string }
  | { type: "session:ended"; sessionId: string }
  | { type: "wager:changed"; proposedMatchId: string }
  | { type: "tournament:created"; tournamentId: string }
  | { type: "tournament:match-recorded"; tournamentId: string }
  | { type: "tournament:ended"; tournamentId: string };

export type RealtimeEventType = RealtimeEvent["type"];
