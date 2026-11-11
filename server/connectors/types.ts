export type ConnectorSource = "pncp" | "compras.gov.br";

/** Campos normalizados são nullable quando não fornecidos pela fonte. */
export interface ProcurementRecord {
  source: ConnectorSource;
  externalId: string | null;
  controlNumber: string | null;
  title: string | null;
  description: string | null;
  organizationName: string | null;
  organizationCnpj: string | null;
  unitName: string | null;
  modalityCode: number | null;
  modalityName: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  proposalOpensAt: string | null;
  proposalClosesAt: string | null;
  estimatedValue: number | null;
  awardedValue: number | null;
  sourceUrl: string;
  raw: Readonly<Record<string, unknown>>;
}

export interface PageMetadata {
  page: number;
  totalPages: number | null;
  totalRecords: number | null;
  pagesRemaining: number | null;
  returned: number;
}

export interface ConnectorPage<T> {
  source: ConnectorSource;
  items: T[];
  metadata: PageMetadata;
  requestUrl: string;
}

export type ConnectorErrorCode =
  | "invalid_input"
  | "timeout"
  | "network"
  | "http"
  | "invalid_response"
  | "pagination_incomplete"
  | "pagination_limit";

export class ConnectorError extends Error {
  readonly name = "ConnectorError";
  constructor(
    message: string,
    readonly code: ConnectorErrorCode,
    readonly source: ConnectorSource,
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export interface PaginationOptions {
  /** Page numbering is one-based at both APIs. */
  page?: number;
  /** Maximum number of pages fetched; defaults are deliberately small. */
  maxPages?: number;
  /** Fetch through the last page reported by the official API, up to MAX_PAGE_LIMIT. */
  allPages?: boolean;
  /** Abort timeout per HTTP request. */
  timeoutMs?: number;
}

export const DEFAULT_MAX_PAGES = 3;
export const DEFAULT_TIMEOUT_MS = 15_000;
/** Safety ceiling. If an API reports more pages, an all-pages run fails explicitly rather than claiming completion. */
export const MAX_PAGE_LIMIT = 1_000;

function retryDelayMs(response: Response | undefined, retryIndex: number): number {
  const retryAfter = response?.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const parsed = Number.isFinite(seconds)
      ? seconds * 1_000
      : Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(parsed) && parsed >= 0) return Math.min(parsed, 30_000);
  }
  return Math.min(500 * (2 ** retryIndex), 30_000);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

/** Retry idempotent official GETs twice on network failures, 429 and 5xx only. */
export async function fetchOfficialPage(
  url: URL,
  timeoutMs: number,
  source: ConnectorSource,
): Promise<Response> {
  for (let attempt = 0; attempt <= 2; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json" } });
    } catch (cause) {
      if (attempt < 2) {
        await wait(retryDelayMs(undefined, attempt));
        continue;
      }
      const timedOut = cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError");
      const label = source === "pncp" ? "PNCP" : "Compras.gov.br";
      throw new ConnectorError(timedOut ? `${label} request timed out` : `${label} network request failed`, timedOut ? "timeout" : "network", source, undefined, { cause });
    }

    const transient = response.status === 429 || response.status >= 500;
    if (transient && attempt < 2) {
      await wait(retryDelayMs(response, attempt));
      continue;
    }
    return response;
  }
  throw new ConnectorError("Official API request exhausted retry attempts", "network", source);
}

/** Parse the expected array shape and retry transient/malformed 200 responses twice. */
export async function fetchOfficialJsonPage(
  url: URL,
  timeoutMs: number,
  source: ConnectorSource,
  expectedArrayField: string,
): Promise<{ response: Response; body: Record<string, unknown> }> {
  const label = source === "pncp" ? "PNCP" : "Compras.gov.br";
  for (let attempt = 0; attempt <= 2; attempt++) {
    const response = await fetchOfficialPage(url, timeoutMs, source);
    if (response.status === 204) return { response, body: {} };
    if (!response.ok) {
      throw new ConnectorError(`${label} returned HTTP ${response.status}`, "http", source, response.status);
    }

    try {
      const parsed = optionalObject(await response.json());
      if (parsed && Array.isArray(parsed[expectedArrayField])) return { response, body: parsed };
    } catch (cause) {
      if (attempt >= 2) {
        throw new ConnectorError(`${label} returned invalid JSON`, "invalid_response", source, response.status, { cause });
      }
    }

    if (attempt < 2) {
      await wait(retryDelayMs(response, attempt));
      continue;
    }
    throw new ConnectorError(`${label} response is missing the expected ${expectedArrayField} array`, "invalid_response", source, response.status);
  }
  throw new ConnectorError("Official API response remained invalid after retries", "invalid_response", source);
}

export function boundedInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
  field: string,
  source: ConnectorSource,
): number {
  const candidate = value ?? fallback;
  if (!Number.isInteger(candidate) || candidate < min || candidate > max) {
    throw new ConnectorError(`${field} must be an integer between ${min} and ${max}`, "invalid_input", source);
  }
  return candidate;
}

export function assertAllPagesFetched<T>(
  pages: ConnectorPage<T>[],
  allPages: boolean,
  maxPages: number,
  source: ConnectorSource,
): void {
  if (!allPages) return;
  const lastPage = pages.at(-1);
  if (!lastPage) return;
  const reportedTotal = [...pages].reverse().find(page => page.metadata.totalPages !== null)?.metadata.totalPages ?? null;
  const reportedRecords = [...pages].reverse().find(page => page.metadata.totalRecords !== null)?.metadata.totalRecords ?? null;
  if (reportedTotal === null) {
    if (pages.length >= maxPages && lastPage.metadata.returned > 0) {
      throw new ConnectorError(
        `Official API pagination exceeded the safety ceiling of ${maxPages} pages; this run is incomplete.`,
        "pagination_limit",
        source,
      );
    }
    throw new ConnectorError(
      "Official API did not provide totalPages, so full coverage cannot be confirmed.",
      "pagination_incomplete",
      source,
    );
  }
  const stoppedEarly = reportedTotal !== null && (
    lastPage.metadata.page < reportedTotal
    || (lastPage.metadata.returned === 0 && lastPage.metadata.page <= reportedTotal && reportedRecords !== 0)
  );
  if (stoppedEarly) {
    if (pages.length >= maxPages && lastPage.metadata.returned > 0) {
      throw new ConnectorError(
        `Official API pagination exceeded the safety ceiling of ${maxPages} pages; this run is incomplete.`,
        "pagination_limit",
        source,
      );
    }
    throw new ConnectorError(
      `Official API stopped at page ${lastPage.metadata.page} while reporting ${reportedTotal} pages.`,
      "pagination_incomplete",
      source,
    );
  }
  const unknownEndAtSafetyCeiling = reportedTotal === null && pages.length >= maxPages && lastPage.metadata.returned > 0;
  if (unknownEndAtSafetyCeiling) {
    throw new ConnectorError(
      `Official API pagination exceeded the safety ceiling of ${maxPages} pages; this run is incomplete.`,
      "pagination_limit",
      source,
    );
  }
}

export function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function optionalObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function optionalArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
