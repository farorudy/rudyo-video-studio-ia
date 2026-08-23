export type ApiPayload = Record<string, unknown>;

export class ApiResponseError extends Error {
  constructor(message: string, public readonly status = 0) {
    super(message);
    this.name = "ApiResponseError";
  }
}

export async function readApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const rawBody = await response.text();
  let data: T | null = null;

  if (rawBody && contentType.includes("application/json")) {
    try {
      data = JSON.parse(rawBody) as T;
    } catch {
      throw new ApiResponseError("Le serveur a renvoyé une réponse JSON invalide.", response.status);
    }
  }

  if (!response.ok) {
    const errorValue = data && typeof data === "object" ? (data as ApiPayload).error : undefined;
    const message = typeof errorValue === "string"
      ? errorValue
      : `La requête a échoué (${response.status}).`;
    throw new ApiResponseError(message, response.status);
  }

  if (!data) {
    throw new ApiResponseError(
      rawBody ? "Le serveur a renvoyé une réponse non JSON." : "Le serveur a renvoyé une réponse vide.",
      response.status,
    );
  }

  return data;
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 30_000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort("timeout"), timeoutMs);
  const abort = () => controller.abort(init.signal?.reason);
  init.signal?.addEventListener("abort", abort, { once: true });

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    return await readApiResponse<T>(response);
  } catch (error) {
    if (controller.signal.aborted && !init.signal?.aborted) {
      throw new ApiResponseError("Le serveur met trop de temps à répondre. Réessayez.", 408);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abort);
  }
}
