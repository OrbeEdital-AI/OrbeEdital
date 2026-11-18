import { describe, expect, it, vi } from "vitest";
import { buildPncpHistoryUrl, fetchPncpHistory, mapPncpHistoryRecords } from "./pncpHistory";

const input = {
  agencyCnpj: "02.304.470/0001-74",
  year: 2026,
  controlNumber: "02304470000174-1-000167/2026",
  rawData: {},
};

describe("PNCP official procurement history", () => {
  it("builds the official history route from the procurement control number", () => {
    expect(buildPncpHistoryUrl(input)).toBe("https://pncp.gov.br/api/pncp/v1/orgaos/02304470000174/compras/2026/167/historico");
  });

  it("maps the official event, name, local timestamp and legal-default justification", () => {
    const events = mapPncpHistoryRecords([
      {
        tipoLogManutencaoNome: "Inclusão",
        categoriaLogManutencaoNome: "Contratação",
        logManutencaoDataInclusao: "2026-11-17T21:45:38",
        justificativa: null,
        documentoTitulo: null,
      },
      {
        tipoLogManutencaoNome: "Inclusão",
        categoriaLogManutencaoNome: "Documento de Contratação",
        logManutencaoDataInclusao: "2026-11-17T21:45:38",
        justificativa: null,
        documentoTitulo: "Edital_PE 90055_2026.pdf",
        documentoSequencial: 1,
      },
      {
        tipoLogManutencaoNome: "Retificação",
        categoriaLogManutencaoNome: "Item de Contratação",
        logManutencaoDataInclusao: "2026-11-17T21:46:39",
        justificativa: "Alteração do item devido a mudança de situação para Em Andamento",
        itemNumero: 1,
      },
    ]);

    expect(events.map(({ event, name, happenedAt, justification }) => ({ event, name, happenedAt, justification }))).toEqual([
      { event: "Inclusão - Contratação", name: "", happenedAt: "2026-11-17T21:45:38", justification: "Exigência Legal" },
      { event: "Inclusão - Documento de Contratação", name: "Edital_PE 90055_2026.pdf", happenedAt: "2026-11-17T21:45:38", justification: "Exigência Legal" },
      { event: "Retificação - Item de Contratação", name: "", happenedAt: "2026-11-17T21:46:39", justification: "Alteração do item devido a mudança de situação para Em Andamento" },
    ]);
  });

  it("loads records from the public official history endpoint", async () => {
    const fakeFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return url.endsWith("/quantidade")
        ? new Response("1", { status: 200, headers: { "content-type": "application/json" } })
        : new Response(JSON.stringify([{
            tipoLogManutencaoNome: "Inclusão",
            categoriaLogManutencaoNome: "Contratação",
            logManutencaoDataInclusao: "2026-11-17T21:45:38",
            justificativa: null,
          }]), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;

    const events = await fetchPncpHistory(input, fakeFetch);
    expect(fakeFetch).toHaveBeenCalledTimes(2);
    expect(events?.[0]).toMatchObject({ event: "Inclusão - Contratação", justification: "Exigência Legal" });
  });
});
