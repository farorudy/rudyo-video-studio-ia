import { createHash, timingSafeEqual } from "node:crypto";
import { callTutorCompletion } from "@/lib/cipfaro-tutor-completion";

type Dependencies = {
  env?: Record<string, string | undefined>;
  send?: typeof fetch;
};

function json(status: number, body: object) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function tokenMatches(provided: string, expected: string) {
  const providedHash = createHash("sha256").update(provided).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedHash, expectedHash);
}

export async function handleOpenAiDiagnostic(request: Request, dependencies: Dependencies = {}) {
  const env = dependencies.env ?? process.env;
  const send = dependencies.send ?? fetch;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) {
        return json(403, { success: false, error: "ORIGIN_REJECTED" });
      }
    } catch {
      return json(403, { success: false, error: "ORIGIN_REJECTED" });
    }
  }

  const expectedToken = env.OPENAI_DIAGNOSTIC_ADMIN_TOKEN?.trim();
  if (!expectedToken || expectedToken.length < 32) {
    return json(503, { success: false, error: "ADMIN_DIAGNOSTIC_NOT_CONFIGURED" });
  }
  const providedToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  if (!tokenMatches(providedToken, expectedToken)) {
    return json(401, { success: false, error: "ADMIN_AUTH_REQUIRED" });
  }

  const apiKey = env.OPENAI_API_KEY?.trim();
  const model = env.OPENAI_MODEL?.trim();
  if (!apiKey) return json(503, { success: false, error: "OPENAI_API_KEY_MISSING" });
  if (!model) return json(503, { success: false, error: "OPENAI_MODEL_MISSING" });

  try {
    const result = await callTutorCompletion({
      provider: "openai",
      apiKey,
      model,
      messages: [{ role: "user", content: "Réponds uniquement par OK." }],
      maxTokens: 8,
      timeoutMs: 12_000,
      send,
    });

    if (!result.ok) {
      const error = result.status === 401 || result.status === 403
        ? "OPENAI_AUTH_FAILED"
        : result.status === 429
          ? "OPENAI_RATE_LIMITED"
          : "OPENAI_REQUEST_REJECTED";
      return json(result.status === 429 ? 429 : 502, { success: false, error, providerStatus: result.status });
    }

    const passed = /^ok[.!]?$/i.test(result.answer.trim());
    if (!passed) {
      return json(502, { success: false, error: "UNEXPECTED_TEST_RESPONSE", model: result.model });
    }

    return json(200, {
      success: true,
      model: result.model,
      answer: result.answer.trim(),
      totalTokens: result.totalTokens,
    });
  } catch {
    return json(502, { success: false, error: "OPENAI_UNAVAILABLE" });
  }
}