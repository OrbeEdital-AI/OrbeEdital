import { describe, expect, it } from "vitest";
import { buildAmmMgSearch, runAmmMgDiscovery } from "./orberadar-fetch";
const html = (body: string) => new Response(body, {headers: {"content-type":"text/html"}});
describe("AMM-MG automatic discovery", () => {\n it("uses public search fields with bounded pagination", () => { const url = buildAmmMgSearch(new Date("2026-11-10T00:00:00Z"), new Date("2026-11-17T00:00:00Z"), "pregão"); expect(url.searchParams.get("busca_avancada[titulo]")).toBe("pregão"); expect(url.searchParams.get("busca_avancada[dataInicio]")).toBe("2026-11-10"); expect(url.searchParams.get("busca_avancada[pagina]")).toBe("1"); });
 it("discovers real-format matter links without manual IDs", async () => {
   const request = (async (url: URL | RequestInfo) => {
     const path = new URL(String(url)).pathname;
     return path === "/amm-mg/pesquisar" ? html('<a href="/amm-mg/materia/57ACFA4E">Aviso de licitação</a>') : html("<main>Aviso de licitação Pregão Eletrônico nº 54/2026 Objeto: contratação de serviços de manutenção para unidades municipais.</main>");
   }) as typeof fetch;
   const result = await runAmmMgDiscovery(new Date("2026-11-17T12:00:00Z"),request);
   expect(result.failures).toEqual([]);
   expect(result.notices).toHaveLength(1);
   expect(result.notices[0].publicationId).toBe("57ACFA4E");
 });
 it("does not guess matter identifiers when search has no links", async () => {
   const request = (async () => html("<main>Nenhuma publicação</main>")) as typeof fetch;
   await expect(runAmmMgDiscovery(new Date(),request)).rejects.toThrow("pesquisa pública não retornou");
 });
});
