"use client";

import { useEffect, useRef, useState } from "react";
import { Mic2, RotateCcw, Sparkles, Save, Volume2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useVoicePromptConfig, useUpdateVoicePromptConfig } from "@/lib/queries/voice-prompt";
import { DEFAULT_VOICE_TEMPLATES, type VoicePromptTemplates } from "@/lib/voice/build-announce-prompt";
import { useAdmin } from "@/components/admin-context";
import { toast } from "sonner";

const FIELDS: Array<{
  key: keyof VoicePromptTemplates;
  label: string;
  hint: string;
  rows: number;
}> = [
  {
    key: "intro",
    label: "Intro (persona du commentateur)",
    hint: "Décrit au LLM qui il est, le ton à adopter, les contraintes de durée et les audio tags.",
    rows: 6,
  },
  {
    key: "goat_template",
    label: "Mode GOAT (joueurs en série de victoires)",
    hint: "Placeholders : {names} = liste des joueurs en forme, {streak} = streak du premier.",
    rows: 4,
  },
  {
    key: "roast_template",
    label: "Mode ROAST (joueurs en série de défaites)",
    hint: "Placeholders : {names}, {streak}. Reste bon-enfant.",
    rows: 4,
  },
  {
    key: "mixed_template",
    label: "Narration mixte (GOAT + ROAST dans le même match)",
    hint: "Pas de placeholder obligatoire — c'est la couleur narrative générale.",
    rows: 3,
  },
];

export function VoicePromptEditor() {
  const { unlocked } = useAdmin();
  const { data: config, isLoading } = useVoicePromptConfig();
  const save = useUpdateVoicePromptConfig();

  const [form, setForm] = useState<VoicePromptTemplates>(DEFAULT_VOICE_TEMPLATES);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (config) setForm(config);
  }, [config]);

  const handleRestore = () => {
    setForm(DEFAULT_VOICE_TEMPLATES);
  };

  const handleSave = async () => {
    if (!unlocked) {
      toast.error("Débloquez le mode admin pour sauvegarder.");
      return;
    }
    try {
      await save.mutateAsync(form);
      toast.success("Prompt voice mode sauvegardé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    }
  };

  const resetAudio = () => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  };

  const handleTest = async () => {
    setPreviewLoading(true);
    setPreview(null);
    resetAudio();
    try {
      const res = await fetch("/api/voice/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates: form }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { text: string };
      setPreview(data.text);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur preview.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleTestWithVoice = async () => {
    setAudioLoading(true);
    setPreview(null);
    resetAudio();
    try {
      const res = await fetch("/api/voice/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates: form, withAudio: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        text: string;
        audio?: string;
        contentType?: string;
      };
      setPreview(data.text);
      if (data.audio) {
        const binary = atob(data.audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: data.contentType ?? "audio/wav" });
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        const audio = new Audio(url);
        audio.play().catch((e) => {
          console.warn("[voice] play failed:", e);
          toast.error(
            e instanceof Error && e.name === "NotAllowedError"
              ? "Lecture auto bloquée par le navigateur."
              : "Impossible de lire l'audio généré.",
          );
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur preview voix.");
    } finally {
      setAudioLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic2 className="h-5 w-5" />
          Prompt du voice mode
        </CardTitle>
        <CardDescription>
          Personnalise le ton du commentateur. Les modifications s&apos;appliquent immédiatement aux prochaines annonces.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!unlocked && (
          <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            Mode admin requis pour sauvegarder — tu peux quand même tester un prompt.
          </p>
        )}
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-md bg-muted" />
        ) : (
          FIELDS.map(({ key, label, hint, rows }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key}>{label}</Label>
              <p className="text-xs text-muted-foreground">{hint}</p>
              <textarea
                id={key}
                rows={rows}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          ))
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleRestore} disabled={save.isPending}>
            <RotateCcw className="h-4 w-4" />
            Valeurs par défaut
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleTest}
            disabled={previewLoading || audioLoading}
          >
            <Sparkles className="h-4 w-4" />
            {previewLoading ? "Génération..." : "Tester (texte)"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleTestWithVoice}
            disabled={previewLoading || audioLoading}
          >
            <Volume2 className="h-4 w-4" />
            {audioLoading ? "Génération..." : "Tester (texte + voix)"}
          </Button>
          <Button type="button" onClick={handleSave} disabled={save.isPending || !unlocked}>
            <Save className="h-4 w-4" />
            {save.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>

        {preview && (
          <div className="space-y-2 rounded-xl bg-muted/40 p-3 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Aperçu (contexte : Lucas en série GOAT, Sarah en série ROAST)
            </p>
            <p className="whitespace-pre-wrap">{preview}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
