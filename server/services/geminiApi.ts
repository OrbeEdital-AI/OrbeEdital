const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const BACKOFF_MS = [1_000, 2_000];
const MAX_RETRY_AFTER_MS = 8_000;

export type GeminiGenerateContentResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

export class GeminiApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly attempts: number,
  ) {
    super(message);
    this.name = "GeminiApiError";
  }
}

type GeminiApiDependencies = {
  fetcher?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
};

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, MAX_RETRY_AFTER_MS);
  }
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return null;
  return Math.min(Math.max(0, date - Date.now()), MAX_RETRY_AFTER_MS);
}

export async function generateGeminiContent(
  model: string,
  apiKey: string,
  body: Record<string, unknown>,
  dependencies: GeminiApiDependencies = {},
): Promise<GeminiGenerateContentResponse> {
  const fetcher = dependencies.fetcher ?? fetch;
  const sleep = dependencies.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  const random = dependencies.random ?? Math.random;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await fetcher(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90_000),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro de rede desconhecido";
      throw new GeminiApiError(`Gemini API request failed: ${message}`, null, attempt);
    }

    if (response.ok) {
      return await response.json() as GeminiGenerateContentResponse;
    }

    const providerError = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    const providerMessage = providerError?.error?.message || "provider request rejected";
    const message = `Gemini API failed with HTTP ${response.status}: ${providerMessage}`;
    const retryable = RETRYABLE_STATUSES.has(response.status);
    if (!retryable || attempt === MAX_ATTEMPTS) {
      throw new GeminiApiError(message, response.status, attempt);
    }

    const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
    const baseDelay = BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
    const jitteredDelay = Math.round(baseDelay * (0.75 + random() * 0.5));
    await sleep(retryAfter ?? jitteredDelay);
  }

  throw new GeminiApiError("Gemini API request exhausted its retry limit", null, MAX_ATTEMPTS);
}
