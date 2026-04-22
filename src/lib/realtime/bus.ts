import type { RealtimeEvent } from "./events";

type Subscriber = (chunk: string) => void;

// Singleton module côté serveur : en dev Next peut recréer le module à chaque
// route reload, on stocke sur globalThis pour garder les connexions ouvertes.
type Globals = typeof globalThis & {
  __babynulRealtimeSubs?: Set<Subscriber>;
};
const g = globalThis as Globals;
if (!g.__babynulRealtimeSubs) g.__babynulRealtimeSubs = new Set<Subscriber>();
const subscribers = g.__babynulRealtimeSubs;

export function subscribe(send: Subscriber): () => void {
  subscribers.add(send);
  return () => {
    subscribers.delete(send);
  };
}

export function publishEvent(event: RealtimeEvent): void {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const send of subscribers) {
    try {
      send(payload);
    } catch {
      // si le writer a été fermé entre-temps, on ignore — la subscribe l'aura nettoyé
    }
  }
}

export function subscriberCount(): number {
  return subscribers.size;
}
