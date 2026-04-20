import { HomeShell } from "@/components/home-shell";
import { isAdminUnlocked } from "@/lib/admin-code";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const unlocked = await isAdminUnlocked();
  return <HomeShell unlocked={unlocked} />;
}
