import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

type SessionPayload = {
  userId: string;
  email?: string;
  name?: string;
  local?: boolean;
  issuedAt: number;
};

const COOKIE_NAME = "rudyo_session";
const ALGORITHM = "aes-256-gcm";
const ENCODING = "base64";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
const EXAMPLE_DATABASE_URL = "postgresql://user:password@localhost:5432/rudyo";
const EXAMPLE_DATABASE_URLS = new Set([
  EXAMPLE_DATABASE_URL,
  "postgresql://USER:PASSWORD@HOST:PORT/DATABASE",
  "postgresql://vrai_user:vrai_password@localhost:5432/rudyo",
]);
const EXAMPLE_AUTH_SECRETS = new Set([
  "your_secret_key_minimum_32_characters_long_here",
  "your-super-secret-auth-cookie-key-of-at-least-32-chars",
  "cle_generee_de_64_caracteres",
]);

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  plan: "FREE" | "STARTER" | "CREATOR" | "STUDIO";
  creditsTotal: number;
  creditsUsed: number;
  creditsRemaining: number;
  monthlyLimit: number;
  monthlyUsed: number;
  billingStatus: "ACTIVE" | "PAST_DUE" | "CANCELED" | "INCOMPLETE" | "TRIALING";
  stripeCustomerId?: string | null;
  preferredAiProvider?: string | null;
  allowPremiumAi?: boolean;
  apiKey?: string | null;
  localSession?: boolean;
};

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function isLocalSessionEnabled() {
  return process.env.USE_LOCAL_SESSION === "true" && !isProduction();
}

export function validateProductionSessionConfig() {
  if (!isProduction()) {
    return;
  }

  if (process.env.USE_LOCAL_SESSION !== "false") {
    throw new Error(
      "Configuration production invalide : USE_LOCAL_SESSION doit etre defini a false sur Vercel/farozik.com.",
    );
  }
}

export function getInitialCredits() {
  const configured = Number.parseInt(process.env.INITIAL_CREDITS ?? "20", 10);
  return Number.isFinite(configured) && configured >= 0 ? configured : 20;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateAuthSecret() {
  const secret = process.env.AUTH_COOKIE_SECRET?.trim();
  if (!secret || EXAMPLE_AUTH_SECRETS.has(secret) || secret.length < 32) {
    throw new Error(
      "Configuration serveur incomplete : AUTH_COOKIE_SECRET manquant ou invalide (minimum 32 caracteres).",
    );
  }
}

export function validateDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl || EXAMPLE_DATABASE_URLS.has(databaseUrl)) {
    throw new Error(
      "Configuration serveur incomplete : DATABASE_URL manquant ou invalide.",
    );
  }

  try {
    const url = new URL(databaseUrl);
    const protocol = url.protocol.replace(":", "");
    const username = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    const databaseName = url.pathname.replace("/", "");

    if (
      !["postgresql", "postgres"].includes(protocol) ||
      ["user", "USER"].includes(username) ||
      ["password", "PASSWORD"].includes(password) ||
      ["host", "HOST"].includes(url.hostname) ||
      !databaseName ||
      (isProduction() &&
        ["localhost", "127.0.0.1", "::1"].includes(url.hostname))
    ) {
      throw new Error("Invalid DATABASE_URL");
    }
  } catch {
    throw new Error(
      "Configuration serveur incomplete : DATABASE_URL manquant ou invalide. En production, utilisez une URL PostgreSQL accessible depuis Vercel, pas localhost.",
    );
  }
}

function getSecretKey() {
  validateAuthSecret();
  return createHash("sha256")
    .update(process.env.AUTH_COOKIE_SECRET!.trim(), "utf8")
    .digest();
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

export async function getCurrentUser(
  req: NextRequest,
): Promise<SessionUser | null> {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) {
    return null;
  }

  const payload = decodePayload(cookie);
  if (!payload || !payload.userId) {
    return null;
  }

  if (Date.now() - payload.issuedAt > SESSION_MAX_AGE_MS) {
    return null;
  }

  if (payload.local) {
    const credits = getInitialCredits();
    return {
      id: payload.userId,
      email: payload.email ?? "local@rudyo.test",
      name: payload.name ?? null,
      plan: "FREE",
      creditsTotal: credits,
      creditsUsed: 0,
      creditsRemaining: credits,
      monthlyLimit: credits,
      monthlyUsed: 0,
      billingStatus: "ACTIVE",
      stripeCustomerId: null,
      preferredAiProvider: null,
      allowPremiumAi: false,
      apiKey: null,
      localSession: true,
    };
  }

  return prisma.user.findUnique({ where: { id: payload.userId } });
}

export function signSessionCookie(
  userId: string,
  options?: { email?: string; name?: string | null; local?: boolean },
) {
  const payload: SessionPayload = {
    userId,
    email: options?.email,
    name: options?.name ?? undefined,
    local: options?.local,
    issuedAt: Date.now(),
  };
  return encodePayload(payload);
}

export function createLocalSessionUser(
  email: string,
  name?: string,
): SessionUser {
  const normalizedEmail = normalizeEmail(email);
  const initialCredits = getInitialCredits();
  return {
    id: `local:${normalizedEmail}`,
    email: normalizedEmail,
    name: name?.trim() || null,
    plan: "FREE",
    creditsTotal: initialCredits,
    creditsUsed: 0,
    creditsRemaining: initialCredits,
    monthlyLimit: initialCredits,
    monthlyUsed: 0,
    billingStatus: "ACTIVE",
    stripeCustomerId: null,
    preferredAiProvider: null,
    allowPremiumAi: false,
    apiKey: null,
    localSession: true,
  };
}

export async function getOrCreateUserByEmail(email: string, name?: string) {
  const normalizedEmail = normalizeEmail(email);
  const initialCredits = getInitialCredits();
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    const shouldInitializeCredits =
      existing.creditsTotal === 0 &&
      existing.creditsUsed === 0 &&
      existing.creditsRemaining === 0 &&
      initialCredits > 0;

    if ((name && !existing.name) || shouldInitializeCredits) {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          name: name && !existing.name ? name.trim() : undefined,
          creditsTotal: shouldInitializeCredits ? initialCredits : undefined,
          creditsRemaining: shouldInitializeCredits ? initialCredits : undefined,
          monthlyLimit: shouldInitializeCredits ? initialCredits : undefined,
        },
      });
    }

    return existing;
  }

  return prisma.user.create({
    data: {
      email: normalizedEmail,
      name: name?.trim() || undefined,
      plan: "FREE",
      billingStatus: "ACTIVE",
      creditsTotal: initialCredits,
      creditsRemaining: initialCredits,
      monthlyLimit: initialCredits,
    },
  });
}

export async function assertDatabaseConnection() {
  validateDatabaseUrl();
  await prisma.$connect();
}

export function requireAuthSecret() {
  validateAuthSecret();
}
