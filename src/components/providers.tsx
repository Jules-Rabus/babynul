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

    (async () => {
      try {
        console.info("[MSW] bootstrap start…");
        const { setupWorker } = await import("msw/browser");
        const { makeHandlers } = await import("@/test/msw/handlers/api-browser");
        const handlers = makeHandlers();
        console.info(`[MSW] ${handlers.length} handlers enregistrés.`);
        const worker = setupWorker(...handlers);
        await worker.start({
          onUnhandledRequest: "warn",
          serviceWorker: { url: "/mockServiceWorker.js" },
          waitUntilReady: true,
        });
        if (!cancelled) {
          console.info("🎭 MSW mock mode ACTIF — toutes les requêtes Supabase sont interceptées.");
          setReady(true);
        }
      } catch (err) {
        console.error("[MSW bootstrap] échec :", err);
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
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
