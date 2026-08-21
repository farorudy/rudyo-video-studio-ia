import "server-only";

import { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeThrottle, hashAuthValue } from "@/lib/verified-auth";
import { readBodyWithLimit } from "@/lib/request-limits";
export { RequestTooLargeError, readBodyWithLimit, sniffMime } from "@/lib/request-limits";

export function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
}

export function clientIpHash(request: NextRequest) {
  return hashAuthValue("ip", clientIp(request));
}

export async function enforceApiRateLimit(
  request: NextRequest,
  scope: string,
  ownerId: string,
  limit: number,
  windowMs: number,
) {
  await consumeThrottle(`api:${scope}:owner`, ownerId, limit, windowMs);
  await consumeThrottle(`api:${scope}:ip`, clientIp(request), limit * 3, windowMs);
}

export async function readJsonWithLimit<T>(request: NextRequest, maxBytes: number): Promise<T> {
  const body = await readBodyWithLimit(request, maxBytes);
  return JSON.parse(body.toString("utf8")) as T;
}

export async function readFormDataWithLimit(request: NextRequest, maxBytes: number) {
  const body = await readBodyWithLimit(request, maxBytes);
  const bounded = new Request(request.url, { method: "POST", headers: request.headers, body });
  return bounded.formData();
}

export function requireIdempotencyKey(request: NextRequest) {
  const value = request.headers.get("idempotency-key")?.trim();
  if (!value || value.length < 8 || value.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(value)) {
    throw new Error("En-tête Idempotency-Key invalide ou manquant.");
  }
  return value;
}

export async function beginIdempotentRequest(scope: string, ownerId: string, key: string) {
  const ownerKey = hashAuthValue("idempotency-owner", ownerId);
  const keyHash = hashAuthValue("idempotency-key", key);
  try {
    const record = await prisma.apiIdempotency.create({
      data: { scope, ownerKey, keyHash, expiresAt: new Date(Date.now() + 24 * 60 * 60_000) },
    });
    return { fresh: true as const, record };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const record = await prisma.apiIdempotency.findUniqueOrThrow({
      where: { scope_ownerKey_keyHash: { scope, ownerKey, keyHash } },
    });
    return { fresh: false as const, record };
  }
}

export async function finishIdempotentRequest(id: string, responseCode: number, response: unknown) {
  await prisma.apiIdempotency.update({
    where: { id },
    data: {
      status: responseCode < 400 ? "SUCCEEDED" : "FAILED",
      responseCode,
      response: response as Prisma.InputJsonValue,
    },
  });
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message = "Délai maximal dépassé.") {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
