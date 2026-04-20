"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession } from "@/hooks/use-session";
import { useRouter } from "next/navigation";

export function AuthButton() {
  const { user, loading } = useSession();
  const router = useRouter();

  if (loading) return <div className="h-10 w-24 animate-pulse rounded-md bg-muted" />;

  if (!user) {
    return (
      <Button onClick={() => router.push("/login")} size="sm">
        Se connecter
      </Button>
    );
  }

  const displayName =
    (user.user_metadata?.full_name as string) ||
    (user.user_metadata?.name as string) ||
    user.email ||
    "Joueur";
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

  return (
    <form action="/auth/signout" method="post" className="flex items-center gap-3">
      <Avatar className="h-9 w-9">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
        <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="hidden flex-col text-left text-xs leading-tight sm:flex">
        <span className="font-medium">{displayName}</span>
        <span className="text-muted-foreground">Connecté</span>
      </div>
      <Button variant="ghost" size="icon" type="submit" aria-label="Se déconnecter">
        <LogOut className="h-4 w-4" />
      </Button>
    </form>
  );
}
