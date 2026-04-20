"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { AdminButton } from "@/components/admin-button";
import { AdminProvider } from "@/components/admin-context";
import { PlayersRanking } from "@/components/ranking/players-ranking";
import { TeamsRanking } from "@/components/ranking/teams-ranking";
import { RecordMatchForm } from "@/components/matches/record-match-form";
import { MatchmakingPanel } from "@/components/matchmaking/matchmaking-panel";
import { PlayersTable } from "@/components/players-admin/players-table";

export function HomeShell({ unlocked }: { unlocked: boolean }) {
  return (
    <AdminProvider unlocked={unlocked}>
      <main className="min-h-screen">
        <header className="border-0 bg-card/50 backdrop-blur-sm">
          <div className="container flex items-center justify-between gap-4 py-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Babynul !</h1>
              <p className="text-sm text-muted-foreground">
                Gestion des parties de Baby-Foot entre collègues
              </p>
            </div>
            <div className="flex items-center gap-2">
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

            <TabsContent value="players">
              <PlayersTable />
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </AdminProvider>
  );
}
