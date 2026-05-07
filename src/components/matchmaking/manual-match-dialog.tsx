"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScoreStepper } from "@/components/ui/score-stepper";
import { useRecordMatch } from "@/lib/queries/matches";
import { usePlayers } from "@/lib/queries/players";
import { displayName } from "@/lib/player-display";
import type { PlayerRow } from "@/lib/db/types";
import { toast } from "sonner";

type Mode = "individual" | "team";

type Props = {
  open: boolean;
  sessionId: string | null;
  ensureSession: () => Promise<string>;
  targetScore?: number;
  presentPlayers: PlayerRow[];
  onClose: () => void;
};

export function ManualMatchDialog({
  open,
  sessionId,
  ensureSession,
  targetScore,
  presentPlayers,
  onClose,
}: Props) {
  const { data: allPlayers = [] } = usePlayers();
  const record = useRecordMatch();

  const [mode, setMode] = useState<Mode>("team");
  const [a1, setA1] = useState<string>("");
  const [a2, setA2] = useState<string>("");
  const [b1, setB1] = useState<string>("");
  const [b2, setB2] = useState<string>("");
  const [scoreA, setScoreA] = useState<number>(targetScore ?? 10);
  const [scoreB, setScoreB] = useState<number>(0);
  const [attachToSession, setAttachToSession] = useState<boolean>(true);

  // Source des joueurs : présents en haut, puis tous les autres.
  const playerOptions = useMemo(() => {
    const presentIds = new Set(presentPlayers.map((p) => p.id));
    const present = presentPlayers
      .slice()
      .sort((a, b) => displayName(a).localeCompare(displayName(b)));
    const others = allPlayers
      .filter((p) => !presentIds.has(p.id))
      .sort((a, b) => displayName(a).localeCompare(displayName(b)));
    return { present, others };
  }, [presentPlayers, allPlayers]);

  const usedIds = useMemo(() => {
    const ids = [a1, a2, b1, b2].filter(Boolean);
    return new Set(ids);
  }, [a1, a2, b1, b2]);

  const renderOption = (p: PlayerRow, slot: string) => (
    <SelectItem
      key={p.id}
      value={p.id}
      disabled={usedIds.has(p.id) && p.id !== slot}
    >
      {displayName(p)}{" "}
      <span className="text-muted-foreground">({p.elo})</span>
    </SelectItem>
  );

  const PlayerSelect = ({
    id,
    value,
    onChange,
    placeholder,
  }: {
    id: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
  }) => (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {playerOptions.present.length > 0 && (
          <>
            <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Présents
            </div>
            {playerOptions.present.map((p) => renderOption(p, value))}
          </>
        )}
        {playerOptions.others.length > 0 && (
          <>
            <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Autres
            </div>
            {playerOptions.others.map((p) => renderOption(p, value))}
          </>
        )}
      </SelectContent>
    </Select>
  );

  useEffect(() => {
    if (open) {
      setMode("team");
      setA1("");
      setA2("");
      setB1("");
      setB2("");
      setScoreA(targetScore ?? 10);
      setScoreB(0);
      setAttachToSession(true);
    }
  }, [open, targetScore]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!a1 || !b1) {
      toast.error("Sélectionnez au moins un joueur dans chaque équipe.");
      return;
    }
    if (mode === "team" && (!a2 || !b2)) {
      toast.error("Mode équipe : 4 joueurs requis.");
      return;
    }
    const ids = mode === "team" ? [a1, a2, b1, b2] : [a1, b1];
    if (new Set(ids).size !== ids.length) {
      toast.error("Les joueurs doivent être distincts.");
      return;
    }
    if (scoreA === scoreB) {
      toast.error("Un vainqueur est requis (pas de match nul).");
      return;
    }
    if (scoreA < 0 || scoreB < 0) {
      toast.error("Scores invalides.");
      return;
    }

    try {
      let sid: string | null = sessionId;
      if (attachToSession && !sid) {
        sid = await ensureSession();
      }
      await record.mutateAsync({
        mode,
        a1,
        a2: mode === "team" ? a2 : null,
        b1,
        b2: mode === "team" ? b2 : null,
        scoreA,
        scoreB,
        sessionId: attachToSession ? sid : null,
        proposedMatchId: null,
      });
      toast.success("Match enregistré.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Saisir un match manuellement</DialogTitle>
          <DialogDescription>
            Choisissez le mode, les joueurs, puis le score. L&apos;Elo sera mis
            à jour comme pour un match du matchmaking.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2">
            <div className="flex gap-1">
              {(["team", "individual"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    if (m === "individual") {
                      setA2("");
                      setB2("");
                    }
                  }}
                  className={
                    "min-h-[36px] min-w-[60px] rounded-md px-3 text-sm font-medium transition-colors " +
                    (mode === m
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-foreground ring-1 ring-border hover:bg-muted")
                  }
                >
                  {m === "team" ? "2v2" : "1v1"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="attach-session"
                checked={attachToSession}
                onCheckedChange={setAttachToSession}
              />
              <Label htmlFor="attach-session" className="text-xs">
                Compter dans la partie du jour
              </Label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Équipe A
              </Label>
              <PlayerSelect
                id="manual-a1"
                value={a1}
                onChange={setA1}
                placeholder="Joueur A1"
              />
              {mode === "team" && (
                <PlayerSelect
                  id="manual-a2"
                  value={a2}
                  onChange={setA2}
                  placeholder="Joueur A2"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Équipe B
              </Label>
              <PlayerSelect
                id="manual-b1"
                value={b1}
                onChange={setB1}
                placeholder="Joueur B1"
              />
              {mode === "team" && (
                <PlayerSelect
                  id="manual-b2"
                  value={b2}
                  onChange={setB2}
                  placeholder="Joueur B2"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ScoreStepper
              id="manual-score-a"
              label="Score A"
              value={scoreA}
              onChange={setScoreA}
              max={30}
            />
            <ScoreStepper
              id="manual-score-b"
              label="Score B"
              value={scoreB}
              onChange={setScoreB}
              max={30}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={record.isPending}>
              {record.isPending ? "Enregistrement…" : "Enregistrer le match"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
