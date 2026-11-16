export type RadarCandidate = { source: "amm-mt" | "amm-mg"; url: string; title: string; publicationId: string; state: "review" };
const MT = "https://amm.diariomunicipal.org";
const MG = "https://www.diariomunicipal.com.br";
export function discoverRadarLinks(html: string, source: RadarCandidate["source"]): RadarCandidate[] {
  const base = source === "amm-mt" ? MT : MG;
  const pattern = source === "amm-mt" ? /^\/publicacao\/(\d+)\/?$/ : /^\/amm-mg\/materia\/([0-9A-F]{8})\/?$/i;
  const seen = new Map<string, RadarCandidate>();
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url: URL;
    try { url = new URL(match[1], base); } catch { continue; }
    const id = pattern.exec(url.pathname)?.[1];
    if (url.origin !== base || !id) continue;
    const title = match[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!title || seen.has(id)) continue;
    seen.set(id, { source, url: base + url.pathname, title, publicationId: id, state: "review" });
  }
  return [...seen.values()];
}
export function buildAmmMtSearch(from: Date, to: Date, page = 1): URL {
  if (!Number.isInteger(page) || page < 1 || page > 3 || !Number.isFinite(+from) || !Number.isFinite(+to) || +from > +to) throw new Error("Invalid radar search");
  const date = (d: Date) => d.toISOString().slice(0, 10);
  const u = new URL("/publicacoes/", MT);
  u.searchParams.set("quick_terms", "licitações");
  u.searchParams.set("dates", date(from) + "," + date(to));
  if (page > 1) u.searchParams.set("p", String(page));
  return u;
}
// Deliberately no network, scheduler or database write until source permissions
// and live extraction have been validated. Session dates are not proposal deadlines.
