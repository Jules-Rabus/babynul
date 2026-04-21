// Client fetch léger pour les endpoints /api/*.

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(err || `GET ${path} → ${res.status}`);
  }
  return (await res.json()) as T;
}
