import {
  createHash,
  createHmac,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE_NAME = "rudyo_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

type AdminSessionPayload = {
  version: 1;
  subject: string;
  issuedAt: number;
  expiresAt: number;
};

export type AdminIdentity = {
  email: string;
  subject: string;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
}

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "ADMIN_SESSION_SECRET doit contenir au moins 32 caractères.",
    );
  }
  return secret;
}

function decodeBase64Secret(name: string, minimumLength: number) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} n'est pas configurée.`);
  }

  const decoded = Buffer.from(value, "base64");
  if (decoded.length < minimumLength) {
    throw new Error(`${name} est invalide.`);
  }
  return decoded;
}

function safeEqual(left: Buffer, right: Buffer) {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function getAdminSubject(email: string) {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

export function validateAdminConfiguration() {
  if (getAdminEmails().length === 0) {
    throw new Error("ADMIN_EMAILS n'est pas configurée.");
  }
  getSessionSecret();
  decodeBase64Secret("ADMIN_PASSWORD_SALT", 16);
  decodeBase64Secret("ADMIN_PASSWORD_HASH", 32);
}

export function verifyAdminCredentials(email: string, password: string) {
  validateAdminConfiguration();
  const normalizedEmail = normalizeEmail(email);
  const emailAllowed = getAdminEmails().includes(normalizedEmail);
  const salt = decodeBase64Secret("ADMIN_PASSWORD_SALT", 16);
  const expectedHash = decodeBase64Secret("ADMIN_PASSWORD_HASH", 32);
  const passwordHash = scryptSync(password || "\0", salt, expectedHash.length);

  if (!emailAllowed || !password || !safeEqual(passwordHash, expectedHash)) {
    return null;
  }

  return {
    email: normalizedEmail,
    subject: getAdminSubject(normalizedEmail),
  } satisfies AdminIdentity;
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getSessionSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function createAdminSessionToken(admin: AdminIdentity) {
  const now = Date.now();
  const payload: AdminSessionPayload = {
    version: 1,
    subject: admin.subject,
    issuedAt: now,
    expiresAt: now + ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

function readAdminSessionToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  try {
    const [encodedPayload, encodedSignature] = token.split(".");
    if (!encodedPayload || !encodedSignature) {
      return null;
    }

    const signature = Buffer.from(encodedSignature, "base64url");
    const expectedSignature = Buffer.from(
      signPayload(encodedPayload),
      "base64url",
    );
    if (!safeEqual(signature, expectedSignature)) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as AdminSessionPayload;
    if (
      payload.version !== 1 ||
      !payload.subject ||
      payload.expiresAt <= Date.now() ||
      payload.issuedAt > Date.now() + 60_000
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getAdminFromRequest(request: NextRequest) {
  const payload = readAdminSessionToken(
    request.cookies.get(ADMIN_COOKIE_NAME)?.value,
  );
  if (!payload) {
    return null;
  }

  const email = getAdminEmails().find(
    (candidate) => getAdminSubject(candidate) === payload.subject,
  );
  if (!email) {
    return null;
  }

  return { email, subject: payload.subject } satisfies AdminIdentity;
}

export function isSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

function csrfForSession(sessionToken: string) {
  return createHmac("sha256", getSessionSecret())
    .update(`admin-csrf:${sessionToken}`)
    .digest("base64url");
}

export function getAdminCsrfToken(request: NextRequest) {
  const sessionToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  return sessionToken && readAdminSessionToken(sessionToken) ? csrfForSession(sessionToken) : null;
}

export function verifyAdminCsrfToken(request: NextRequest) {
  const expected = getAdminCsrfToken(request);
  const provided = request.headers.get("x-csrf-token")?.trim();
  if (!expected || !provided) return false;
  return safeEqual(Buffer.from(expected), Buffer.from(provided));
}

export function hasStrictSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  return origin === request.nextUrl.origin && (!fetchSite || fetchSite === "same-origin");
}
