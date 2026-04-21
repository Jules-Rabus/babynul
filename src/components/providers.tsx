"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";

function MSWBootstrap({ children }: { children: React.ReactNode }) {
  const enabled = process.env.NEXT_PUBLIC_USE_MSW === "1";
  const [ready, setReady] = useState(!enabled);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    (async () => {
      const { setupWorker } = await import("msw/browser");
      const { makeHandlers } = await import("@/test/msw/handlers/supabase-browser");
      const worker = setupWorker(...makeHandlers());
      await worker.start({
        onUnhandledRequest: "bypass",
        serviceWorker: { url: "/mockServiceWorker.js" },
      });
      console.info("🎭 MSW mock mode ON — tous les appels Supabase sont interceptés.");
      setReady(true);
    })();
  }, [enabled]);

  if (!ready) return null;
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
        <MSWBootstrap>{children}</MSWBootstrap>
        <Toaster position="top-right" richColors closeButton />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
