"use server";

import { revalidatePath } from "next/cache";
import { clearAdminCookie, getAdminCode, setAdminCookie } from "@/lib/admin-code";

export type UnlockResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "invalid" };

export async function unlockWithCode(code: string): Promise<UnlockResult> {
  const expected = getAdminCode();
  if (!expected) return { ok: false, reason: "not_configured" };
  if (code.trim() !== expected) return { ok: false, reason: "invalid" };
  await setAdminCookie();
  revalidatePath("/");
  return { ok: true };
}

export async function lockAdmin(): Promise<void> {
  await clearAdminCookie();
  revalidatePath("/");
}
