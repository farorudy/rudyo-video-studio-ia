import { timingSafeEqual } from "node:crypto";

export type OtpRecordState = {
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  attempts: number;
  maxAttempts: number;
};

export type OtpDecision =
  | { ok: true }
  | { ok: false; reason: "missing" | "expired" | "used" | "locked" | "invalid" };

function equalHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function evaluateOtp(
  record: OtpRecordState | null,
  candidateHash: string,
  now = new Date(),
): OtpDecision {
  if (!record) return { ok: false, reason: "missing" };
  if (record.usedAt) return { ok: false, reason: "used" };
  if (record.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  if (record.attempts >= record.maxAttempts) return { ok: false, reason: "locked" };
  return equalHex(record.tokenHash, candidateHash)
    ? { ok: true }
    : { ok: false, reason: "invalid" };
}
