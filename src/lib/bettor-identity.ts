// Identité locale du parieur : un UUID unique par device stocké en localStorage,
// plus un pseudo affiché à côté du solde.

const KEY_STORAGE = "babynul-bettor-key";
const NICK_STORAGE = "babynul-bettor-nickname";

export function getBettorKey(): string {
  if (typeof window === "undefined") return "";
  let k = window.localStorage.getItem(KEY_STORAGE);
  if (!k) {
    k = crypto.randomUUID();
    window.localStorage.setItem(KEY_STORAGE, k);
  }
  return k;
}

export function getNickname(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(NICK_STORAGE) ?? "";
}

export function setNickname(value: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NICK_STORAGE, value.trim());
}
