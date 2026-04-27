import { z } from "zod";

// ============================================================================
// Primitives
// ============================================================================

export const UuidSchema = z.string().uuid();
export const ModeSchema = z.enum(["individual", "team"]);
export const SideSchema = z.enum(["A", "B"]);
export const StatusSchema = z.enum(["open", "resolved", "cancelled"]);
export const SessionStatusSchema = z.enum(["active", "ended"]);
export const ScoreSchema = z.number().int().nonnegative().max(30);
export const TargetScoreSchema = z.number().int().min(1).max(30);
export const EloSchema = z.number().int().min(200).max(3000);
export const NicknameSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .nullable()
  .optional();
export const FirstNameSchema = z.string().trim().min(1).max(40);

// ============================================================================
// Players
// ============================================================================

export const AddPlayerSchema = z.object({
  first_name: FirstNameSchema,
  elo: EloSchema,
  nickname: NicknameSchema,
});
export type AddPlayerInput = z.infer<typeof AddPlayerSchema>;

export const UpdateNicknameSchema = z.object({
  id: UuidSchema,
  nickname: z.string().trim().max(40).nullable(),
});
export type UpdateNicknameInput = z.infer<typeof UpdateNicknameSchema>;

export const DeletePlayerSchema = z.object({
  id: UuidSchema,
});
export type DeletePlayerInput = z.infer<typeof DeletePlayerSchema>;

// ============================================================================
// Matches
// ============================================================================

export const RecordMatchSchema = z
  .object({
    mode: ModeSchema,
    a1: UuidSchema,
    a2: UuidSchema.nullable(),
    b1: UuidSchema,
    b2: UuidSchema.nullable(),
    scoreA: ScoreSchema,
    scoreB: ScoreSchema,
    sessionId: UuidSchema.nullable().optional(),
    proposedMatchId: UuidSchema.nullable().optional(),
    targetScore: TargetScoreSchema.optional(),
  })
  .refine((v) => v.scoreA !== v.scoreB, {
    message: "Un vainqueur est requis (pas de match nul).",
    path: ["scoreA"],
  })
  .refine(
    (v) =>
      v.targetScore === undefined ||
      Math.max(v.scoreA, v.scoreB) === v.targetScore,
    {
      message: "Le vainqueur doit atteindre exactement le score cible.",
      path: ["scoreA"],
    },
  )
  .refine(
    (v) =>
      v.mode === "individual" ||
      (v.a2 !== null && v.b2 !== null && v.a2 !== undefined && v.b2 !== undefined),
    {
      message: "Mode équipe : les 4 joueurs sont requis.",
      path: ["a2"],
    },
  )
  .refine(
    (v) => {
      const ids = [v.a1, v.a2, v.b1, v.b2].filter(
        (id): id is string => typeof id === "string",
      );
      return new Set(ids).size === ids.length;
    },
    {
      message: "Les joueurs doivent être distincts.",
      path: ["a1"],
    },
  );
export type RecordMatchInput = z.infer<typeof RecordMatchSchema>;

export const PlayerMatchesQuerySchema = z.object({
  playerId: UuidSchema,
  limit: z.coerce.number().int().positive().max(500).default(500),
});

export const RecentMatchesQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(365).default(30),
});

export const SessionMatchesQuerySchema = z.object({
  sessionId: UuidSchema,
});

// ============================================================================
// Play sessions
// ============================================================================

export const StartSessionSchema = z.object({
  label: z.string().trim().min(1).max(120).nullable().optional(),
  targetScore: TargetScoreSchema.optional(),
});
export type StartSessionInput = z.infer<typeof StartSessionSchema>;

export const EndSessionSchema = z.object({
  sessionId: UuidSchema,
});
export type EndSessionInput = z.infer<typeof EndSessionSchema>;

export const SessionPresenceSchema = z.object({
  sessionId: UuidSchema,
  playerId: UuidSchema,
  present: z.boolean(),
});
export type SessionPresenceInput = z.infer<typeof SessionPresenceSchema>;

export const CancelOpenSessionMatchesSchema = z.object({
  sessionId: UuidSchema,
  involvingPlayer: UuidSchema.nullable().optional(),
});
export type CancelOpenSessionMatchesInput = z.infer<
  typeof CancelOpenSessionMatchesSchema
>;

// ============================================================================
// Proposed matches
// ============================================================================

export const CreateProposedMatchSchema = z.object({
  mode: ModeSchema,
  team_a_p1: UuidSchema,
  team_a_p2: UuidSchema.nullable(),
  team_b_p1: UuidSchema,
  team_b_p2: UuidSchema.nullable(),
  elo_a: EloSchema,
  elo_b: EloSchema,
  session_id: UuidSchema.nullable().optional(),
});
export type CreateProposedMatchInput = z.infer<typeof CreateProposedMatchSchema>;

export const CancelProposedMatchSchema = z.object({
  proposedMatchId: UuidSchema,
});
export type CancelProposedMatchInput = z.infer<typeof CancelProposedMatchSchema>;

export const ResolveProposedMatchSchema = z.object({
  proposedMatchId: UuidSchema,
  winnerSide: SideSchema,
  matchId: UuidSchema.nullable().optional(),
});
export type ResolveProposedMatchInput = z.infer<typeof ResolveProposedMatchSchema>;

export const ProposedMatchesQuerySchema = z.object({
  sessionId: UuidSchema.optional(),
});

// ============================================================================
// Tournaments
// ============================================================================

export const TournamentSlotIndividualSchema = z.object({
  player_id: UuidSchema,
  label: z.string().trim().max(60).optional(),
});

export const TournamentSlotTeamSchema = z.object({
  p1: UuidSchema,
  p2: UuidSchema,
  label: z.string().trim().max(60).optional(),
});

export const CreateTournamentSchema = z
  .object({
    mode: ModeSchema,
    label: z.string().trim().min(1).max(120).nullable().optional(),
    targetScore: TargetScoreSchema.default(10),
    sessionId: UuidSchema.nullable().optional(),
    slots: z.array(z.union([TournamentSlotIndividualSchema, TournamentSlotTeamSchema])).min(2),
  })
  .refine(
    (v) =>
      v.slots.every((s) =>
        v.mode === "individual" ? "player_id" in s : "p1" in s && "p2" in s,
      ),
    {
      message: "Chaque slot doit correspondre au mode du tournoi.",
      path: ["slots"],
    },
  )
  .refine(
    (v) => {
      const ids: string[] = [];
      for (const s of v.slots) {
        if ("player_id" in s) ids.push(s.player_id);
        else {
          ids.push(s.p1, s.p2);
        }
      }
      return new Set(ids).size === ids.length;
    },
    { message: "Les joueurs doivent être distincts.", path: ["slots"] },
  );
export type CreateTournamentInput = z.infer<typeof CreateTournamentSchema>;

export const RecordTournamentMatchSchema = z.object({
  tournamentMatchId: UuidSchema,
  scoreA: ScoreSchema,
  scoreB: ScoreSchema,
}).refine((v) => v.scoreA !== v.scoreB, {
  message: "Un vainqueur est requis.",
  path: ["scoreA"],
});
export type RecordTournamentMatchInput = z.infer<typeof RecordTournamentMatchSchema>;

export const EndTournamentSchema = z.object({
  tournamentId: UuidSchema,
});
export type EndTournamentInput = z.infer<typeof EndTournamentSchema>;

export const TournamentsQuerySchema = z.object({
  status: z.enum(["active", "ended"]).optional(),
  date: z.enum(["today"]).optional(),
});

// ============================================================================
// Wagers
// ============================================================================

export const PlaceWagerSchema = z.object({
  playerId: UuidSchema,
  proposedMatchId: UuidSchema,
  side: SideSchema,
  stake: z.number().int().positive().max(100_000),
});
export type PlaceWagerInput = z.infer<typeof PlaceWagerSchema>;

export const WagersQuerySchema = z.object({
  proposedMatchId: UuidSchema,
});

// ============================================================================
// Voice prompt
// ============================================================================

export const VoicePromptSchema = z.object({
  intro: z.string().min(10).max(4000),
  goat_template: z.string().min(5).max(2000),
  roast_template: z.string().min(5).max(2000),
  mixed_template: z.string().min(5).max(2000),
});
export type VoicePromptInput = z.infer<typeof VoicePromptSchema>;

export const AnnounceRequestSchema = z.object({
  proposedMatchId: UuidSchema,
  sessionId: UuidSchema.nullable().optional(),
});

export const AnnouncePreviewSchema = z.object({
  templates: VoicePromptSchema.partial().optional(),
  context: z
    .object({
      teamA: z.array(z.any()),
      teamB: z.array(z.any()),
    })
    .optional(),
});
