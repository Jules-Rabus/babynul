"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { ErrorBoundary } from "./error-boundary";

function MSWBootstrap({ children }: { children: React.ReactNode }) {
  const enabled = process.env.NEXT_PUBLIC_USE_MSW === "1";
  const [ready, setReady] = useState(!enabled);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    let cancelled = false;

    // Garde-fou : si MSW hang (SW qui attend son activation sur un 1er chargement),
    // on débloque l'UI après 2,5 s — l'app rend quand même, les appels réels
    // iront sur l'URL factice https://mock.supabase.local (inoffensif, échecs fetch).
    const safety = setTimeout(() => {
      if (!cancelled && !document.querySelector("[data-msw-ready]")) {
        console.warn("[MSW] timeout de bootstrap — rendu sans garantie d'interception.");
        setReady(true);
      }
    }, 2500);

    (async () => {
      try {
        const { setupWorker } = await import("msw/browser");
        const { makeHandlers } = await import("@/test/msw/handlers/supabase-browser");
        const worker = setupWorker(...makeHandlers());
        await worker.start({
          onUnhandledRequest: "bypass",
          serviceWorker: { url: "/mockServiceWorker.js" },
          quiet: true,
        });
        if (!cancelled) {
          console.info("🎭 MSW mock mode ON — tous les appels Supabase sont interceptés.");
          document.body.setAttribute("data-msw-ready", "1");
          setReady(true);
        }
      } catch (err) {
        console.error("[MSW bootstrap] échec — on rend l'app sans interception :", err);
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(safety);
    };
  }, [enabled]);

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Chargement du mode mock…
      </div>
    );
  }
  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <MSWBootstrap>{children}</MSWBootstrap>
        </ErrorBoundary>
        <Toaster position="top-right" richColors closeButton />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
