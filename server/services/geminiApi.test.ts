import { describe, expect, it, vi } from "vitest";
import { generateGeminiContent, GeminiApiError } from "./geminiApi";

function jsonResponse(status: number, body: unknown, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...Object.fromEntries(new Headers(headers).entries()) },
  });
}

const requestBody = {
  contents: [{ role: "user", parts: [{ text: "Analise o edital" }] }],
};

describe("generateGeminiContent", () => {
  it("repete após HTTP 503 e retorna a primeira resposta bem-sucedida", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(503, { error: { message: "high demand" } }))
      .mockResolvedValueOnce(jsonResponse(200, { candidates: [{ content: { parts: [{ text: "{}" }] } }] }));
    const sleep = vi.fn<(milliseconds: number) => Promise<void>>().mockResolvedValue(undefined);

    const result = await generateGeminiContent("gemini-3.5-flash-lite", "test-key", requestBody, {
      fetcher,
      sleep,
      random: () => 0.5,
    });

    expect(result.candidates?.[0]?.content?.parts?.[0]?.text).toBe("{}");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1_000);
  });

  it("respeita Retry-After para erro transitório", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(429, { error: { message: "quota busy" } }, { "retry-after": "0.25" }))
      .mockResolvedValueOnce(jsonResponse(200, { candidates: [] }));
    const sleep = vi.fn<(milliseconds: number) => Promise<void>>().mockResolvedValue(undefined);

    await generateGeminiContent("gemini-3.5-flash-lite", "test-key", requestBody, {
      fetcher,
      sleep,
      random: () => 0.5,
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);
  });

  it("encerra após três respostas transitórias sem sucesso e preserva o status", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
      jsonResponse(503, { error: { message: "high demand" } }),
    );
    const sleep = vi.fn<(milliseconds: number) => Promise<void>>().mockResolvedValue(undefined);

    let thrown: unknown;
    try {
      await generateGeminiContent("gemini-3.5-flash-lite", "test-key", requestBody, {
        fetcher,
        sleep,
        random: () => 0.5,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(GeminiApiError);
    expect((thrown as GeminiApiError).status).toBe(503);
    expect((thrown as GeminiApiError).attempts).toBe(3);
    expect((thrown as Error).message).toBe("Gemini API failed with HTTP 503: high demand");
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("não repete erros do provedor que não são transitórios", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(400, { error: { message: "invalid request" } }),
    );
    const sleep = vi.fn<(milliseconds: number) => Promise<void>>().mockResolvedValue(undefined);

    await expect(generateGeminiContent("gemini-3.5-flash-lite", "test-key", requestBody, {
      fetcher,
      sleep,
    })).rejects.toMatchObject({ status: 400, attempts: 1 });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
