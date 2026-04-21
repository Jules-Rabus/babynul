type HasName = { first_name: string; nickname?: string | null };

export function displayName(p: HasName): string {
  const nick = p.nickname?.trim();
  return nick ? `${p.first_name} (${nick})` : p.first_name;
}

export function announceName(p: HasName): string {
  const nick = p.nickname?.trim();
  return nick || p.first_name;
}
