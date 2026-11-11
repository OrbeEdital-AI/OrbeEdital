import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

function readCsrfCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = "licitahub_csrf=";
  const pair = document.cookie.split(";").map(part => part.trim()).find(part => part.startsWith(prefix));
  return pair?.slice(prefix.length);
}

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        const token = readCsrfCookie();
        return token ? { "x-csrf-token": token } : {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, { ...(init ?? {}), credentials: "include" });
      },
    }),
  ],
});

async function bootstrap() {
  try {
    await fetch("/api/auth/csrf", { credentials: "include", cache: "no-store" });
  } catch {
    // The application still renders a useful connection error state.
  }
  createRoot(document.getElementById("root")!).render(
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>,
  );
}

void bootstrap();
