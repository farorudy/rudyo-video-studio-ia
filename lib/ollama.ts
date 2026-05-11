import { request as httpRequest } from "http";
import { request as httpsRequest } from "https";

type OllamaGeneratePayload = {
  model: string;
  prompt: string;
  stream?: boolean;
  format?: string;
};

type OllamaGenerateResponse = {
  response?: string;
  error?: string;
};

function readResponseBody(chunks: Buffer[]) {
  return Buffer.concat(chunks).toString("utf8");
}

export async function callOllamaGenerate(
  baseUrl: string,
  payload: OllamaGeneratePayload,
  timeoutMs = 15 * 60 * 1000,
) {
  const url = new URL("/api/generate", baseUrl);
  const body = JSON.stringify(payload);
  const requestImpl = url.protocol === "https:" ? httpsRequest : httpRequest;

  return await new Promise<OllamaGenerateResponse>((resolve, reject) => {
    const req = requestImpl(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];

        res.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        res.on("end", () => {
          const rawText = readResponseBody(chunks);

          if ((res.statusCode ?? 500) >= 400) {
            reject(
              new Error(
                `Ollama indisponible (${res.statusCode ?? 500}): ${rawText}`,
              ),
            );
            return;
          }

          try {
            resolve(JSON.parse(rawText) as OllamaGenerateResponse);
          } catch (error) {
            reject(
              error instanceof Error
                ? error
                : new Error("Réponse Ollama invalide."),
            );
          }
        });
      },
    );

    req.on("error", reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("Ollama a dépassé le délai maximum."));
    });
    req.write(body);
    req.end();
  });
}
