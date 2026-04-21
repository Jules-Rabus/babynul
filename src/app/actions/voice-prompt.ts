"use server";

import { prisma } from "@/lib/prisma";
import { VoicePromptSchema } from "@/lib/schemas";
import { assertAdmin } from "@/lib/admin-guard";

export async function updateVoicePromptConfig(raw: unknown): Promise<void> {
  await assertAdmin();
  const input = VoicePromptSchema.parse(raw);
  await prisma.voicePromptConfig.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      intro: input.intro,
      goatTemplate: input.goat_template,
      roastTemplate: input.roast_template,
      mixedTemplate: input.mixed_template,
    },
    update: {
      intro: input.intro,
      goatTemplate: input.goat_template,
      roastTemplate: input.roast_template,
      mixedTemplate: input.mixed_template,
      updatedAt: new Date(),
    },
  });
}
