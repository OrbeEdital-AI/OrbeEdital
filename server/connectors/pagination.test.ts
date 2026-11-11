import { afterEach, describe, expect, it, vi } from "vitest";
import { searchCompras } from "./compras";
import { searchPncpOpen } from "./pncp";
import { assertAllPagesFetched, MAX_PAGE_LIMIT, type ConnectorPage } from "./types";

afterEach(() => vi.unstubAllGlobals());

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("complete official-source pagination", () => {
  it("reads every PNCP open-proposals page without imposing a modality filter", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        data: [{ numeroControlePNCP: "A", objetoCompra: "Item A" }],
        totalRegistros: 2,
        totalPaginas: 2,
        numeroPagina: 1,
        paginasRestantes: 1,
      }))
      .mockResolvedValueOnce(jsonResponse({
        data: [{ numeroControlePNCP: "B", objetoCompra: "Item B" }],
        totalRegistros: 2,
        totalPaginas: 2,
        numeroPagina: 2,
        paginasRestantes: 0,
      }));
    vi.stubGlobal("fetch", fetchMock);

    const pages = await searchPncpOpen({ dataFinal: "20261110", allPages: true, tamanhoPagina: 50 });

    expect(pages).toHaveLength(2);
    expect(pages.flatMap(page => page.items).map(item => item.controlNumber)).toEqual(["A", "B"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [input] of fetchMock.mock.calls) {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/api/consulta/v1/contratacoes/proposta");
      expect(url.searchParams.get("dataFinal")).toBe("20261110");
      expect(url.searchParams.has("codigoModalidadeContratacao")).toBe(false);
      expect(url.searchParams.get("tamanhoPagina")).toBe("50");
    }
  });

  it("follows all Compras.gov.br pages and supports the official 500-record page size", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        resultado: [{ idCompra: "A" }],
        totalRegistros: 2,
        totalPaginas: 2,
        paginasRestantes: 1,
      }))
      .mockResolvedValueOnce(jsonResponse({
        resultado: [{ idCompra: "B" }],
        totalRegistros: 2,
        totalPaginas: 2,
        paginasRestantes: 0,
      }));
    vi.stubGlobal("fetch", fetchMock);

    const pages = await searchCompras({
      dataPublicacaoPncpInicial: "2026-11-03",
      dataPublicacaoPncpFinal: "2026-11-10",
      codigoModalidade: 5,
      allPages: true,
      tamanhoPagina: 500,
    });

    expect(pages).toHaveLength(2);
    expect(pages.flatMap(page => page.items).map(item => item.externalId)).toEqual(["A", "B"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [input] of fetchMock.mock.calls) {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/modulo-contratacoes/1_consultarContratacoes_PNCP_14133");
      expect(url.searchParams.get("codigoModalidade")).toBe("5");
      expect(url.searchParams.get("tamanhoPagina")).toBe("500");
    }
  });

  it("retries a PNCP HTTP 429 according to Retry-After before reading the page", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(jsonResponse({ data: [], totalRegistros: 0, totalPaginas: 0, paginasRestantes: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    const pages = await searchPncpOpen({ dataFinal: "20261110", allPages: true, tamanhoPagina: 50 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(pages).toHaveLength(1);
    expect(pages[0]?.items).toHaveLength(0);
  });

  it("retries a malformed HTTP 200 response instead of treating it as an empty successful result", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("not-json", { status: 200, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(jsonResponse({ data: [], totalRegistros: 0, totalPaginas: 0, paginasRestantes: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    const pages = await searchPncpOpen({ dataFinal: "20261110", allPages: true, tamanhoPagina: 50 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(pages).toHaveLength(1);
    expect(pages[0]?.items).toHaveLength(0);
  });

  it("fails if PNCP returns an empty page before the reported final page", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      data: [],
      totalRegistros: 51,
      totalPaginas: 2,
      numeroPagina: 1,
      paginasRestantes: 1,
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchPncpOpen({ dataFinal: "20261110", allPages: true, tamanhoPagina: 50 }))
      .rejects.toMatchObject({ code: "pagination_incomplete" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails closed if PNCP omits totalPages in an all-pages response", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ data: [], totalRegistros: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchPncpOpen({ dataFinal: "20261110", allPages: true, tamanhoPagina: 50 }))
      .rejects.toMatchObject({ code: "pagination_incomplete" });
  });

  it("fails if PNCP returns 204 on a page still expected by earlier metadata", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        data: [{ numeroControlePNCP: "A" }],
        totalRegistros: 51,
        totalPaginas: 2,
        numeroPagina: 1,
        paginasRestantes: 1,
      }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchPncpOpen({ dataFinal: "20261110", allPages: true, tamanhoPagina: 50 }))
      .rejects.toMatchObject({ code: "pagination_incomplete" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails rather than claiming completion when the safety page ceiling truncates a run", () => {
    const pages: ConnectorPage<unknown>[] = Array.from({ length: MAX_PAGE_LIMIT }, (_, index) => ({
      source: "pncp",
      items: [{}],
      requestUrl: "https://pncp.gov.br/api/consulta/v1/contratacoes/proposta",
      metadata: { page: index + 1, totalPages: MAX_PAGE_LIMIT + 1, totalRecords: null, pagesRemaining: null, returned: 1 },
    }));

    expect(() => assertAllPagesFetched(pages, true, MAX_PAGE_LIMIT, "pncp"))
      .toThrow(/exceeded the safety ceiling/i);
  });
});
