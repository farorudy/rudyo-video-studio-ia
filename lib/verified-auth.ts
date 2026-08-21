import "server-only";

import { createHmac, randomBytes, randomInt } from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluateOtp } from "@/lib/auth-policy";
import { sendLoginOtp } from "@/lib/auth-email";
import { getInitialCredits, normalizeEmail, sanitizeUserName } from "@/lib/auth";

const OTP_TTL_MS = 10 * 60_000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60_000;

export class AuthRateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Trop de tentatives. Réessayez plus tard.");
  }
}

function authSecret() {
  const value = process.env.AUTH_SECRET?.trim();
  if (!value || value.length < 32) {
    throw new Error("AUTH_SECRET manquant ou invalide.");
  }
  return value;
}

export function hashAuthValue(purpose: string, value: string) {
  return createHmac("sha256", authSecret()).update(`${purpose}:${value}`, "utf8").digest("hex");
}

export function sessionTokenHash(rawToken: string) {
  return hashAuthValue("session", rawToken);
}

function requestIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
}

export async function consumeThrottle(action: string, identity: string, limit: number, windowMs: number) {
  const now = new Date();
  const keyHash = hashAuthValue("throttle", identity);
  const outcome = await prisma.$transaction(async (tx) => {
    const current = await tx.authThrottle.findUnique({ where: { keyHash_action: { keyHash, action } } });
    if (!current || now.getTime() - current.windowStart.getTime() >= windowMs) {
      await tx.authThrottle.upsert({
        where: { keyHash_action: { keyHash, action } },
        create: { keyHash, action, windowStart: now, attempts: 1 },
        update: { windowStart: now, attempts: 1, blockedUntil: null },
      });
      return { blocked: false, retryAfterSeconds: 0 };
    }
    if (current.blockedUntil && current.blockedUntil > now) {
      return { blocked: true, retryAfterSeconds: Math.ceil((current.blockedUntil.getTime() - now.getTime()) / 1000) };
    }
    const attempts = current.attempts + 1;
    const overflow = Math.max(0, attempts - limit);
    const delaySeconds = overflow > 0 ? Math.min(900, 15 * 2 ** Math.min(overflow - 1, 6)) : 0;
    const blockedUntil = delaySeconds ? new Date(now.getTime() + delaySeconds * 1000) : null;
    await tx.authThrottle.update({ where: { id: current.id }, data: { attempts, blockedUntil } });
    return { blocked: overflow > 0, retryAfterSeconds: delaySeconds };
  });
  if (outcome.blocked) throw new AuthRateLimitError(outcome.retryAfterSeconds);
}

export async function requestLoginOtp(request: NextRequest, emailInput: string, nameInput?: string) {
  const email = normalizeEmail(emailInput);
  const name = sanitizeUserName(nameInput);
  const ipHash = hashAuthValue("ip", requestIp(request));
  await consumeThrottle("otp-request-email", email, 5, 60 * 60_000);
  await consumeThrottle("otp-request-ip", requestIp(request), 20, 60 * 60_000);

  const otp = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const tokenHash = hashAuthValue(`otp:${email}`, otp);
  const now = new Date();
  await prisma.$transaction([
    prisma.emailVerificationToken.updateMany({
      where: { email, usedAt: null },
      data: { usedAt: now },
    }),
    prisma.emailVerificationToken.create({
      data: {
        email,
        requestedName: name || null,
        tokenHash,
        requestedIpHash: ipHash,
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      },
    }),
  ]);

  try {
    await sendLoginOtp(email, otp);
  } catch (error) {
    await prisma.emailVerificationToken.updateMany({ where: { tokenHash, usedAt: null }, data: { usedAt: new Date() } });
    throw error;
  }
}

export async function verifyLoginOtp(request: NextRequest, emailInput: string, otp: string) {
  const email = normalizeEmail(emailInput);
  await consumeThrottle("otp-verify-email", email, 10, 15 * 60_000);
  await consumeThrottle("otp-verify-ip", requestIp(request), 30, 15 * 60_000);
  const record = await prisma.emailVerificationToken.findFirst({ where: { email }, orderBy: { createdAt: "desc" } });
  const candidateHash = hashAuthValue(`otp:${email}`, otp);
  const decision = evaluateOtp(record, candidateHash);
  if (!decision.ok) {
    if (record && !record.usedAt && record.attempts < record.maxAttempts) {
      await prisma.emailVerificationToken.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    }
    throw new Error("Code invalide ou expiré.");
  }
  if (!record) throw new Error("Code invalide ou expiré.");
  const verifiedRecord = record;

  const rawSessionToken = randomBytes(32).toString("base64url");
  const tokenHash = sessionTokenHash(rawSessionToken);
  const now = new Date();
  const user = await prisma.$transaction(async (tx) => {
    const consumed = await tx.emailVerificationToken.updateMany({
      where: { id: verifiedRecord.id, usedAt: null, expiresAt: { gt: now }, attempts: { lt: verifiedRecord.maxAttempts } },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) throw new Error("Code invalide ou expiré.");
    const initialCredits = getInitialCredits();
    const verifiedUser = await tx.user.upsert({
      where: { email },
      create: {
        email,
        name: verifiedRecord.requestedName || undefined,
        emailVerifiedAt: now,
        credits: initialCredits,
        creditsTotal: initialCredits,
        creditsRemaining: initialCredits,
        monthlyLimit: initialCredits,
      },
      update: {
        emailVerifiedAt: now,
        ...(verifiedRecord.requestedName ? { name: verifiedRecord.requestedName } : {}),
      },
    });
    await tx.authSession.create({
      data: { userId: verifiedUser.id, tokenHash, expiresAt: new Date(now.getTime() + SESSION_TTL_MS) },
    });
    return verifiedUser;
  });
  return { user, rawSessionToken };
}

export async function revokeRequestSession(request: NextRequest) {
  const raw = request.cookies.get("rudyo_session")?.value;
  if (!raw || raw.includes(":")) return;
  await prisma.authSession.updateMany({
    where: { tokenHash: sessionTokenHash(raw), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function rotateRequestSession(request: NextRequest) {
  const raw = request.cookies.get("rudyo_session")?.value;
  if (!raw || raw.includes(":")) return null;
  const oldHash = sessionTokenHash(raw);
  const threshold = new Date(Date.now() - 24 * 60 * 60_000);
  const current = await prisma.authSession.findFirst({
    where: { tokenHash: oldHash, revokedAt: null, expiresAt: { gt: new Date() }, createdAt: { lte: threshold } },
  });
  if (!current) return null;
  const nextRaw = randomBytes(32).toString("base64url");
  const nextHash = sessionTokenHash(nextRaw);
  const now = new Date();
  const rotated = await prisma.$transaction(async (tx) => {
    const revoked = await tx.authSession.updateMany({ where: { id: current.id, revokedAt: null }, data: { revokedAt: now, rotatedAt: now } });
    if (revoked.count !== 1) return false;
    await tx.authSession.create({ data: { userId: current.userId, tokenHash: nextHash, expiresAt: new Date(now.getTime() + SESSION_TTL_MS) } });
    return true;
  });
  return rotated ? nextRaw : null;
}
