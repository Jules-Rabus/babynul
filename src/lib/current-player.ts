// Identité locale : l'utilisateur choisit QUI il est dans la liste des joueurs.
// Le player_id est stocké en localStorage côté client.

const KEY = "babynul-current-player-id";

export function getCurrentPlayerId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function setCurrentPlayerId(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, id);
}

export function clearCurrentPlayerId() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
