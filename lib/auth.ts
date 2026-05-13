import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

type SessionPayload = {
  userId: string;
  issuedAt: number;
};

const COOKIE_NAME = "rudyo_session";
const ALGORITHM = "aes-256-gcm";
const ENCODING = "base64";
const SECRET = process.env.AUTH_COOKIE_SECRET || "";

function getSecretKey() {
  if (!SECRET || SECRET.length < 32) {
    throw new Error(
      "AUTH_COOKIE_SECRET doit être défini et contenir au moins 32 caractères.",
    );
  }
  return Buffer.from(SECRET.slice(0, 32), "utf8");
}

function encodePayload(payload: SessionPayload) {
  const text = JSON.stringify(payload);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getSecretKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString(ENCODING),
    encrypted.toString(ENCODING),
    authTag.toString(ENCODING),
  ].join(":");
}

function decodePayload(token: string): SessionPayload | null {
  try {
    const [ivPart, encryptedPart, tagPart] = token.split(":");
    if (!ivPart || !encryptedPart || !tagPart) {
      return null;
    }
    const iv = Buffer.from(ivPart, ENCODING);
    const encrypted = Buffer.from(encryptedPart, ENCODING);
    const authTag = Buffer.from(tagPart, ENCODING);
    const decipher = createDecipheriv(ALGORITHM, getSecretKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString("utf8")) as SessionPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) {
    return null;
  }

  const payload = decodePayload(cookie);
  if (!payload || !payload.userId) {
    return null;
  }

  return prisma.user.findUnique({ where: { id: payload.userId } });
}

export function signSessionCookie(userId: string) {
  const payload: SessionPayload = {
    userId,
    issuedAt: Date.now(),
  };
  return encodePayload(payload);
}

export async function getOrCreateUserByEmail(email: string, name?: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    if (name && !existing.name) {
      await prisma.user.update({ where: { id: existing.id }, data: { name } });
    }
    return existing;
  }

  return prisma.user.create({
    data: {
      email: normalizedEmail,
      name: name?.trim() || undefined,
      plan: "FREE",
      billingStatus: "ACTIVE",
      monthlyLimit: 0,
    },
  });
}

export function requireAuthSecret() {
  if (
    !process.env.AUTH_COOKIE_SECRET ||
    process.env.AUTH_COOKIE_SECRET.length < 32
  ) {
    throw new Error(
      "AUTH_COOKIE_SECRET est requise pour le système d'authentification Rudyo.",
    );
  }
}
