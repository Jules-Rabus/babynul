"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { updateVoicePromptConfig } from "@/app/actions/voice-prompt";
import {
  DEFAULT_VOICE_TEMPLATES,
  type VoicePromptTemplates,
} from "@/lib/voice/build-announce-prompt";

export const VOICE_PROMPT_KEY = ["voice-prompt", "active"] as const;

export function useVoicePromptConfig() {
  return useQuery({
    queryKey: VOICE_PROMPT_KEY,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<VoicePromptTemplates> => {
      try {
        return await apiGet<VoicePromptTemplates>("/api/voice/config");
      } catch {
        return DEFAULT_VOICE_TEMPLATES;
      }
    },
  });
}

export function useUpdateVoicePromptConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: VoicePromptTemplates) =>
      updateVoicePromptConfig(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: VOICE_PROMPT_KEY }),
  });
}
