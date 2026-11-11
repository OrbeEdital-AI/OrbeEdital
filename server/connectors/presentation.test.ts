import { describe, expect, it } from "vitest";
import { buildPncpDetailUrl, normalizeProcurementStatus } from "./presentation";

describe("PNCP public presentation helpers", () => {
  it("builds a human PNCP page from the direct PNCP payload", () => {
    expect(buildPncpDetailUrl({
      agencyCnpj: "24134488000108",
      raw: {
        orgaoEntidade: { cnpj: "24134488000108" },
        anoCompra: 2026,
        sequencialCompra: 191,
      },
    })).toBe("https://pncp.gov.br/app/editais/24134488000108/2026/191");
  });

  it("builds a human PNCP page from Compras.gov.br's PNCP fields", () => {
    expect(buildPncpDetailUrl({
      agencyCnpj: null,
      raw: {
        orgaoEntidadeCnpj: "35872812000101",
        anoCompraPncp: 2026,
        sequencialCompraPncp: 103,
      },
    })).toBe("https://pncp.gov.br/app/editais/35872812000101/2026/103");
  });

  it("returns no link rather than an API root or guessed record URL when identifiers are missing", () => {
    expect(buildPncpDetailUrl({ agencyCnpj: "24134488000108", raw: { anoCompra: 2026 } })).toBeNull();
    expect(buildPncpDetailUrl({ agencyCnpj: "invalid", raw: { anoCompra: 2026, sequencialCompra: 191 } })).toBeNull();
  });

  it("maps the official PNCP publication state instead of showing unknown", () => {
    expect(normalizeProcurementStatus({ situacaoCompraNomePncp: "Divulgada no PNCP" })).toBe("published");
    expect(normalizeProcurementStatus({ situacaoCompraNome: "Divulgada no PNCP" })).toBe("published");
  });

  it("preserves a safe fallback when the source does not provide a status", () => {
    expect(normalizeProcurementStatus({}, "receiving_proposals")).toBe("receiving_proposals");
  });
});
