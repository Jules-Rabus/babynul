"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { AdminButton } from "@/components/admin-button";
import { AdminProvider } from "@/components/admin-context";
import { IdentityPicker } from "@/components/identity-picker";
import { PlayersRanking } from "@/components/ranking/players-ranking";
import { TeamsRanking } from "@/components/ranking/teams-ranking";
import { RecordMatchForm } from "@/components/matches/record-match-form";
import { MatchmakingPanel } from "@/components/matchmaking/matchmaking-panel";
import { PlayersTable } from "@/components/players-admin/players-table";
import { TournamentPanel } from "@/components/tournament/tournament-panel";
import { WagersPanel } from "@/components/wagers/wagers-panel";

export function HomeShell({ unlocked }: { unlocked: boolean }) {
  return (
    <AdminProvider unlocked={unlocked}>
      <main className="min-h-screen">
        <header className="border-0 bg-card/50 backdrop-blur-sm pt-[env(safe-area-inset-top)]">
          <div className="container flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Babynul !</h1>
              <p className="hidden text-sm text-muted-foreground sm:block">
                Gestion des parties de Baby-Foot entre collègues
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <IdentityPicker />
              <ThemeToggle />
              <AdminButton />
            </div>
          </div>
        </header>

        <section className="container py-6">
          <Tabs defaultValue="ranking">
            <div className="-mx-4 overflow-x-auto px-4 scrollbar-none">
              <TabsList className="w-max">
                <TabsTrigger value="ranking">Classement</TabsTrigger>
                <TabsTrigger value="record">Saisir un match</TabsTrigger>
                <TabsTrigger value="matchmaking">Matchmaking</TabsTrigger>
                <TabsTrigger value="tournament">Tournoi</TabsTrigger>
                <TabsTrigger value="wagers">Paris</TabsTrigger>
                <TabsTrigger value="players">Joueurs</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="ranking" className="grid gap-4 lg:grid-cols-2">
              <PlayersRanking />
              <TeamsRanking />
            </TabsContent>

            <TabsContent value="record">
              <div className="mx-auto max-w-2xl">
                <RecordMatchForm />
              </div>
            </TabsContent>

            <TabsContent value="matchmaking">
              <MatchmakingPanel />
            </TabsContent>

            <TabsContent value="tournament">
              <TournamentPanel />
            </TabsContent>

            <TabsContent value="wagers">
              <WagersPanel />
            </TabsContent>

            <TabsContent value="players">
              <PlayersTable />
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </AdminProvider>
  );
}
