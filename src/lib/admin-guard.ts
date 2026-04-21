import { isAdminUnlocked } from "./admin-code";

export async function assertAdmin(): Promise<void> {
  const unlocked = await isAdminUnlocked();
  if (!unlocked) {
    throw new Error("Mode admin requis pour cette action.");
  }
}
