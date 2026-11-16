import { buildAmmMtSearch, discoverRadarLinks, type RadarCandidate } from "./orberadar";
import { parseRadarNotice, type RadarNotice } from "./orberadar-notice";

const allowed = new Set(["https://amm.diariomunicipal.org","https://www.diariomunicipal.com.br"]);
export async function fetchRadarHtml(url: URL, request: typeof fetch = fetch): Promise<string> {
  if (!allowed.has(url.origin) || url.username || url.password) throw new Error("Unsupported radar origin");
  const response = await request(url, { redirect: "error", signal: AbortSignal.timeout(15000), headers: { "User-Agent": "OrbeRadar/1.0 (public notice pilot)", Accept: "text/html" } });
  if (!response.ok) throw new Error("Radar HTTP " + response.status);
  if (!response.headers.get("content-type")?.includes("text/html")) throw new Error("Unexpected radar content type");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing radar response");
  const decoder = new TextDecoder();
  let size = 0, html = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2_000_000) throw new Error("Radar response exceeds limit");
      html += decoder.decode(value, { stream: true });
    }
    return html + decoder.decode();
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
export function radarPlainText(html: string): string {
  const region = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1] ?? /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(html)?.[1] ?? html;
  return region.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi," ").replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/\s+/g," ").trim();
}
// Explicit dry run only; no database writes or automatic publication.
export async function runAmmMtPilot(now = new Date(), request: typeof fetch = fetch): Promise<{ notices: RadarNotice[]; failures: string[] }> {
  const from = new Date(+now - 7 * 86400000);
  const candidates = new Map<string,RadarCandidate>();
  const failures: string[] = [];
  const pause = () => new Promise<void>(resolve => setTimeout(resolve,1100));
  for (let page=1; page<=2; page++) {
    const links = discoverRadarLinks(await fetchRadarHtml(buildAmmMtSearch(from,now,page),request),"amm-mt");
    await pause();
    if (!links.length) break;
    for (const link of links) candidates.set(link.publicationId,link);
  }
  const notices: RadarNotice[] = [];
  for (const candidate of [...candidates.values()].slice(0,12)) {
    try {
      const plain = radarPlainText(await fetchRadarHtml(new URL(candidate.url),request));
      if (/aviso\s+(?:de\s+)?(?:abertura\s+de\s+)?licita|aviso\s+de\s+dispensa/iu.test(plain)) notices.push(parseRadarNotice(candidate,plain));
    } catch (error) { failures.push(candidate.publicationId + ": " + (error instanceof Error ? error.message : "unknown")); }
    finally { await pause(); }
  }
  return {notices,failures};
}

/** Manual public matter validation; not an automated MG discovery feed. */
export async function runAmmMgPilot(ids: string[], request: typeof fetch = fetch): Promise<{notices: RadarNotice[]; failures: string[]}> {
 const unique = [...new Set(ids.map(id=>id.toUpperCase()))];
 if (!unique.length || unique.length>5 || unique.some(id=>!/^[A-F0-9]{8}$/.test(id))) throw new Error("Informe até cinco identificadores AMM-MG válidos.");
 const notices: RadarNotice[] = [], failures: string[] = [];
 for (const id of unique) {
  const url = new URL("/amm-mg/materia/"+id,"https://www.diariomunicipal.com.br");
  try {
   const plain = radarPlainText(await fetchRadarHtml(url,request));
   if (!/\b(?:licita[çc][ãa]o|preg[ãa]o|concorr[êe]ncia|dispensa)\b/iu.test(plain)) throw new Error("Matéria sem evidência de licitação");
   notices.push(parseRadarNotice({source:"amm-mg",url:url.href,title:"Matéria AMM-MG "+id,publicationId:id,state:"review"},plain));
  } catch(error) { failures.push(id+": "+(error instanceof Error?error.message:"unknown")); }
  finally { await new Promise<void>(resolve=>setTimeout(resolve,1100)); }
 }
 return {notices,failures};
}
