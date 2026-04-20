import { cookies } from "next/headers";

const COOKIE_NAME = "babynul_admin";
const COOKIE_VALUE = "1";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

// Le vrai code est stocké côté serveur uniquement (pas de préfixe NEXT_PUBLIC_).
// Jamais envoyé au navigateur - il ne transite que via une Server Action POST.
export function getAdminCode(): string | null {
  const code = process.env.ADMIN_CODE;
  return code && code.length > 0 ? code : null;
}

export async function isAdminUnlocked(): Promise<boolean> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value === COOKIE_VALUE;
}

export async function setAdminCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function clearAdminCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
