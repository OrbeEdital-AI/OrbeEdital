/** Admin-only diagnostics for candidate open-data feeds. Never imports into customer opportunities. */
const ALLOWED_HOSTS = new Set(["dados.tce.rs.gov.br", "dados.gov.br"]);
export async function probeCandidateSource(source: "tce-rs" | "dados-gov", timeoutMs = 12000) {
  const url = source === "tce-rs" ? "https://dados.tce.rs.gov.br/" : "https://dados.gov.br/";
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: "GET", signal: controller.signal, redirect: "manual", headers: { "Accept": "text/html,application/json" } });
    const contentType = response.headers.get("content-type") ?? "não informado";
    const location = response.headers.get("location");
    const redirectHost = location ? new URL(location, url).hostname : null;
    return {
      source, endpoint: url, httpStatus: response.status, contentType,
      elapsedMs: Date.now() - started,
      accessible: response.ok,
      redirectHost: redirectHost && ALLOWED_HOSTS.has(redirectHost) ? redirectHost : null,
      status: "diagnostic_only" as const,
      warning: "Acesso ao catálogo não confirma a existência de um arquivo de licitações, atualidade ou possibilidade de importação.",
    };
  } finally {
    clearTimeout(timer);
  }
}
