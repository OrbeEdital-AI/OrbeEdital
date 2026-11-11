import {
  assertAllPagesFetched,
  boundedInteger,
  ConnectorError,
  DEFAULT_MAX_PAGES,
  DEFAULT_TIMEOUT_MS,
  fetchOfficialJsonPage,
  MAX_PAGE_LIMIT,
  optionalArray,
  optionalNumber,
  optionalObject,
  optionalString,
  type ConnectorPage,
  type PaginationOptions,
  type ProcurementRecord,
} from "./types";

const SOURCE = "compras.gov.br" as const;
const API_BASE = "https://dadosabertos.compras.gov.br";

export interface ComprasSearch extends PaginationOptions {
  dataPublicacaoPncpInicial: string; // YYYY-MM-DD
  dataPublicacaoPncpFinal: string; // YYYY-MM-DD
  codigoModalidade: number;
  unidadeOrgaoCodigoUnidade?: string;
  codigoOrgao?: number;
  orgaoEntidadeCnpj?: string;
  unidadeOrgaoCodigoIbge?: number;
  unidadeOrgaoUfSigla?: string;
  dataAualizacaoPncp?: string;
  amparoLegalCodigoPncp?: number;
  contratacaoExcluida?: boolean;
  tamanhoPagina?: number;
}

function validateDate(value: string, name: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ConnectorError(`${name} must use YYYY-MM-DD`, "invalid_input", SOURCE);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ConnectorError(`${name} is not a valid calendar date`, "invalid_input", SOURCE);
  }
}

function toRecord(value: unknown, requestUrl: string): ProcurementRecord {
  const r = optionalObject(value) ?? {};
  const cnpj = optionalString(r.orgaoEntidadeCnpj);
  const year = optionalNumber(r.anoCompraPncp);
  const sequence = optionalNumber(r.sequencialCompraPncp);
  const id = optionalString(r.idCompra);
  return {
    source: SOURCE,
    externalId: id ?? (cnpj !== null && year !== null && sequence !== null ? `${cnpj}/${year}/${sequence}` : null),
    controlNumber: optionalString(r.numeroControlePNCP),
    title: optionalString(r.objetoCompra),
    description: optionalString(r.informacaoComplementar),
    organizationName: optionalString(r.orgaoEntidadeRazaoSocial),
    organizationCnpj: cnpj,
    unitName: optionalString(r.unidadeOrgaoNomeUnidade),
    modalityCode: optionalNumber(r.modalidadeIdPncp) ?? optionalNumber(r.codigoModalidade),
    modalityName: optionalString(r.modalidadeNome),
    publishedAt: optionalString(r.dataPublicacaoPncp),
    updatedAt: optionalString(r.dataAtualizacaoPncp),
    proposalOpensAt: optionalString(r.dataAberturaPropostaPncp),
    proposalClosesAt: optionalString(r.dataEncerramentoPropostaPncp),
    estimatedValue: optionalNumber(r.valorTotalEstimado),
    awardedValue: optionalNumber(r.valorTotalHomologado),
    sourceUrl: requestUrl,
    raw: r,
  };
}

/**
 * GET https://dadosabertos.compras.gov.br/modulo-contratacoes/1_consultarContratacoes_PNCP_14133
 * Official query requires publication dates and codigoModalidade; tamanhoPagina accepts up to 500.
 */
export async function searchCompras(options: ComprasSearch): Promise<ConnectorPage<ProcurementRecord>[]> {
  validateDate(options.dataPublicacaoPncpInicial, "dataPublicacaoPncpInicial");
  validateDate(options.dataPublicacaoPncpFinal, "dataPublicacaoPncpFinal");
  if (options.dataAualizacaoPncp !== undefined) validateDate(options.dataAualizacaoPncp, "dataAualizacaoPncp");
  if (!Number.isInteger(options.codigoModalidade)) {
    throw new ConnectorError("codigoModalidade must be an integer", "invalid_input", SOURCE);
  }
  const page = boundedInteger(options.page, 1, 1, Number.MAX_SAFE_INTEGER, "page", SOURCE);
  const allPages = options.allPages === true;
  if (allPages && page !== 1) {
    throw new ConnectorError("allPages must start at page 1 to guarantee full coverage", "invalid_input", SOURCE);
  }
  const maxPages = allPages
    ? MAX_PAGE_LIMIT
    : boundedInteger(options.maxPages, DEFAULT_MAX_PAGES, 1, MAX_PAGE_LIMIT, "maxPages", SOURCE);
  const pageSize = boundedInteger(options.tamanhoPagina, 10, 10, 500, "tamanhoPagina", SOURCE);
  const timeoutMs = boundedInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, 1, 120_000, "timeoutMs", SOURCE);
  const filters: Record<string, string | number | boolean | undefined> = {
    unidadeOrgaoCodigoUnidade: options.unidadeOrgaoCodigoUnidade,
    codigoOrgao: options.codigoOrgao,
    orgaoEntidadeCnpj: options.orgaoEntidadeCnpj,
    dataPublicacaoPncpInicial: options.dataPublicacaoPncpInicial,
    dataPublicacaoPncpFinal: options.dataPublicacaoPncpFinal,
    codigoModalidade: options.codigoModalidade,
    unidadeOrgaoCodigoIbge: options.unidadeOrgaoCodigoIbge,
    unidadeOrgaoUfSigla: options.unidadeOrgaoUfSigla,
    dataAualizacaoPncp: options.dataAualizacaoPncp,
    amparoLegalCodigoPncp: options.amparoLegalCodigoPncp,
    contratacaoExcluida: options.contratacaoExcluida,
  };
  const pages: ConnectorPage<ProcurementRecord>[] = [];
  for (let index = 0; index < maxPages; index++) {
    const currentPage = page + index;
    const url = new URL(`${API_BASE}/modulo-contratacoes/1_consultarContratacoes_PNCP_14133`);
    for (const [key, value] of Object.entries({ ...filters, pagina: currentPage, tamanhoPagina: pageSize })) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const { response, body } = await fetchOfficialJsonPage(url, timeoutMs, SOURCE, "resultado");
    const results = optionalArray(body.resultado);
    const totalPages = optionalNumber(body.totalPaginas);
    pages.push({
      source: SOURCE,
      items: results.map((row) => toRecord(row, url.toString())),
      metadata: {
        page: currentPage,
        totalPages,
        totalRecords: optionalNumber(body.totalRegistros),
        pagesRemaining: optionalNumber(body.paginasRestantes),
        returned: results.length,
      },
      requestUrl: url.toString(),
    });
    if (response.status === 204 || results.length === 0 || (totalPages !== null && currentPage >= totalPages)) break;
  }

  assertAllPagesFetched(pages, allPages, maxPages, SOURCE);
  return pages;
}
