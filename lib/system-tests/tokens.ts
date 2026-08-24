import { createHash, timingSafeEqual } from "node:crypto";

export function hashSystemTestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function verifySystemTestDownloadToken(token: string, hash: string) {
  const provided = Buffer.from(hashSystemTestToken(token));
  const expected = Buffer.from(hash);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
