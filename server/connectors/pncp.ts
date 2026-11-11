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

const SOURCE = "pncp" as const;
const API_BASE = "https://pncp.gov.br/api/consulta";

export interface PncpSearch extends PaginationOptions {
  dataInicial: string; // yyyyMMdd
  dataFinal: string; // yyyyMMdd
  codigoModalidadeContratacao: number;
  codigoModoDisputa?: number;
  uf?: string;
  codigoMunicipioIbge?: string;
  cnpj?: string;
  codigoUnidadeAdministrativa?: string;
  idUsuario?: number;
  tamanhoPagina?: number;
}

export interface PncpOpenSearch extends PaginationOptions {
  /** Required by GET /v1/contratacoes/proposta; format yyyyMMdd. */
  dataFinal: string;
  codigoModalidadeContratacao?: number;
  uf?: string;
  codigoMunicipioIbge?: string;
  cnpj?: string;
  codigoUnidadeAdministrativa?: string;
  idUsuario?: number;
  tamanhoPagina?: number;
}

function validateDate(value: string, name: string): void {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
  if (!match || !date || date.toISOString().slice(0, 10) !== `${match[1]}-${match[2]}-${match[3]}`) {
    throw new ConnectorError(`${name} must use yyyyMMdd`, "invalid_input", SOURCE);
  }
}

function toRecord(value: unknown, requestUrl: string): ProcurementRecord {
  const r = optionalObject(value) ?? {};
  const org = optionalObject(r.orgaoEntidade);
  const unit = optionalObject(r.unidadeOrgao);
  const idBits = [optionalString(org?.cnpj), optionalNumber(r.anoCompra), optionalNumber(r.sequencialCompra)];
  const sourceUrl = optionalString(r.linkSistemaOrigem) ?? requestUrl;
  return {
    source: SOURCE,
    externalId: idBits.every((x) => x !== null) ? idBits.join("/") : optionalString(r.numeroControlePNCP),
    controlNumber: optionalString(r.numeroControlePNCP),
    title: optionalString(r.objetoCompra),
    description: optionalString(r.informacaoComplementar),
    organizationName: optionalString(org?.razaoSocial),
    organizationCnpj: optionalString(org?.cnpj),
    unitName: optionalString(unit?.nomeUnidade),
    modalityCode: optionalNumber(r.modalidadeId),
    modalityName: optionalString(r.modalidadeNome),
    publishedAt: optionalString(r.dataPublicacaoPncp),
    updatedAt: optionalString(r.dataAtualizacaoGlobal) ?? optionalString(r.dataAtualizacao),
    proposalOpensAt: optionalString(r.dataAberturaProposta),
    proposalClosesAt: optionalString(r.dataEncerramentoProposta),
    estimatedValue: optionalNumber(r.valorTotalEstimado),
    awardedValue: optionalNumber(r.valorTotalHomologado),
    sourceUrl,
    raw: r,
  };
}

async function fetchPages(
  endpoint: "publicacao" | "proposta",
  baseParams: Record<string, string | number | undefined>,
  options: PaginationOptions & { pageSize?: number },
): Promise<ConnectorPage<ProcurementRecord>[]> {
  const page = boundedInteger(options.page, 1, 1, Number.MAX_SAFE_INTEGER, "page", SOURCE);
  const allPages = options.allPages === true;
  if (allPages && page !== 1) {
    throw new ConnectorError("allPages must start at page 1 to guarantee full coverage", "invalid_input", SOURCE);
  }
  const maxPages = allPages
    ? MAX_PAGE_LIMIT
    : boundedInteger(options.maxPages, DEFAULT_MAX_PAGES, 1, MAX_PAGE_LIMIT, "maxPages", SOURCE);
  const pageSize = boundedInteger(options.pageSize, 10, 10, 50, "tamanhoPagina", SOURCE);
  const timeoutMs = boundedInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, 1, 120_000, "timeoutMs", SOURCE);
  const pages: ConnectorPage<ProcurementRecord>[] = [];

  for (let index = 0; index < maxPages; index++) {
    const currentPage = page + index;
    const url = new URL(`${API_BASE}/v1/contratacoes/${endpoint}`);
    for (const [key, value] of Object.entries({ ...baseParams, pagina: currentPage, tamanhoPagina: pageSize })) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const { response, body } = await fetchOfficialJsonPage(url, timeoutMs, SOURCE, "data");
    const data = optionalArray(body.data);
    const totalPages = optionalNumber(body.totalPaginas);
    pages.push({
      source: SOURCE,
      items: data.map((row) => toRecord(row, url.toString())),
      metadata: {
        page: currentPage,
        totalPages,
        totalRecords: optionalNumber(body.totalRegistros),
        pagesRemaining: optionalNumber(body.paginasRestantes),
        returned: data.length,
      },
      requestUrl: url.toString(),
    });
    if (response.status === 204 || data.length === 0 || (totalPages !== null && currentPage >= totalPages)) break;
  }

  assertAllPagesFetched(pages, allPages, maxPages, SOURCE);
  return pages;
}

/**
 * GET /v1/contratacoes/publicacao.
 * Official query parameters include publication dates and a required modality.
 */
export async function searchPncp(options: PncpSearch): Promise<ConnectorPage<ProcurementRecord>[]> {
  validateDate(options.dataInicial, "dataInicial");
  validateDate(options.dataFinal, "dataFinal");
  if (!Number.isInteger(options.codigoModalidadeContratacao)) {
    throw new ConnectorError("codigoModalidadeContratacao must be an integer", "invalid_input", SOURCE);
  }
  const params: Record<string, string | number | undefined> = {
    dataInicial: options.dataInicial,
    dataFinal: options.dataFinal,
    codigoModalidadeContratacao: options.codigoModalidadeContratacao,
    codigoModoDisputa: options.codigoModoDisputa,
    uf: options.uf,
    codigoMunicipioIbge: options.codigoMunicipioIbge,
    cnpj: options.cnpj,
    codigoUnidadeAdministrativa: options.codigoUnidadeAdministrativa,
    idUsuario: options.idUsuario,
  };
  return fetchPages("publicacao", params, { ...options, pageSize: options.tamanhoPagina });
}

/**
 * GET /v1/contratacoes/proposta.
 * Official PNCP description: contratações com recebimento de propostas aberto.
 * Modality is optional; omitting it queries all modalities. Supports page sizes 10–50.
 */
export async function searchPncpOpen(options: PncpOpenSearch): Promise<ConnectorPage<ProcurementRecord>[]> {
  validateDate(options.dataFinal, "dataFinal");
  if (options.codigoModalidadeContratacao !== undefined && !Number.isInteger(options.codigoModalidadeContratacao)) {
    throw new ConnectorError("codigoModalidadeContratacao must be an integer", "invalid_input", SOURCE);
  }
  const params: Record<string, string | number | undefined> = {
    dataFinal: options.dataFinal,
    codigoModalidadeContratacao: options.codigoModalidadeContratacao,
    uf: options.uf,
    codigoMunicipioIbge: options.codigoMunicipioIbge,
    cnpj: options.cnpj,
    codigoUnidadeAdministrativa: options.codigoUnidadeAdministrativa,
    idUsuario: options.idUsuario,
  };
  return fetchPages("proposta", params, { ...options, pageSize: options.tamanhoPagina });
}
