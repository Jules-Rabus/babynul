import Link from "next/link";
import { Github, ScrollText, Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-12 border-t border-border/50 bg-muted/20 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/demo"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <Sparkles className="h-4 w-4" />
            Démo
          </Link>
          <Link
            href="/reglement"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <ScrollText className="h-4 w-4" />
            Règlement
          </Link>
          <a
            href="https://github.com/Jules-Rabus/babynul"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
        </div>
        <p className="text-xs">
          Babynul · Baby-foot + Elo + paris fictifs · propulsé par Supabase &amp; Vercel
        </p>
      </div>
    </footer>
  );
}
