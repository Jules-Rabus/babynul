"use server";

import { prisma } from "@/lib/prisma";
import {
  AddPlayerSchema,
  UpdateNicknameSchema,
  DeletePlayerSchema,
} from "@/lib/schemas";
import { assertAdmin } from "@/lib/admin-guard";

export async function addPlayer(raw: unknown) {
  await assertAdmin();
  const input = AddPlayerSchema.parse(raw);
  const row = await prisma.player.create({
    data: {
      firstName: input.first_name,
      elo: input.elo,
      nickname: input.nickname?.trim() || null,
    },
  });
  return row;
}

export async function updatePlayerNickname(raw: unknown) {
  await assertAdmin();
  const input = UpdateNicknameSchema.parse(raw);
  const row = await prisma.player.update({
    where: { id: input.id },
    data: { nickname: input.nickname?.trim() || null },
  });
  return row;
}

export async function deletePlayerCascade(raw: unknown) {
  await assertAdmin();
  const input = DeletePlayerSchema.parse(raw);
  await prisma.$executeRaw`select public.delete_player_cascade(${input.id}::uuid)`;
}
