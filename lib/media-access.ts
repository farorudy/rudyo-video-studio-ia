import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const value = process.env.AUTH_SECRET?.trim();
  if (!value || value.length < 32) throw new Error("AUTH_SECRET manquant ou invalide.");
  return value;
}

function signature(assetId: string, expires: number) {
  return createHmac("sha256", secret())
    .update(`media:${assetId}:${expires}`, "utf8")
    .digest("base64url");
}

export function verifyMediaSignature(assetId: string, expires: number, supplied: string) {
  if (!Number.isSafeInteger(expires) || expires <= Math.floor(Date.now() / 1000) || expires > Math.floor(Date.now() / 1000) + 3600) {
    return false;
  }
  const expected = Buffer.from(signature(assetId, expires));
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function signedMediaUrl(assetId: string, ttlSeconds = 15 * 60) {
  const base = process.env.APP_BASE_URL?.trim().replace(/\/$/, "");
  if (!base) throw new Error("APP_BASE_URL manquant.");
  const parsed = new URL(base);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error("APP_BASE_URL doit être une origine HTTPS publique.");
  }
  const expires = Math.floor(Date.now() / 1000) + Math.min(Math.max(ttlSeconds, 60), 3600);
  const url = new URL(`/api/media/${encodeURIComponent(assetId)}`, parsed.origin);
  url.searchParams.set("expires", String(expires));
  url.searchParams.set("signature", signature(assetId, expires));
  return url.toString();
}
