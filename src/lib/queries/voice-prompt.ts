"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_VOICE_TEMPLATES, type VoicePromptTemplates } from "@/lib/voice/build-announce-prompt";

export const VOICE_PROMPT_KEY = ["voice-prompt", "active"] as const;

export function useVoicePromptConfig() {
  return useQuery({
    queryKey: VOICE_PROMPT_KEY,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<VoicePromptTemplates> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("voice_prompt_config")
        .select("intro, goat_template, roast_template, mixed_template")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_VOICE_TEMPLATES;
      return data as VoicePromptTemplates;
    },
  });
}

export function useUpdateVoicePromptConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: VoicePromptTemplates) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("voice_prompt_config")
        .upsert({ id: 1, ...input, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: VOICE_PROMPT_KEY }),
  });
}
