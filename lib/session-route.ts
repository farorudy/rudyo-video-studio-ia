import { NextRequest, NextResponse } from "next/server";
import {
  assertDatabaseConnection,
  createLocalSessionUser,
  getCurrentUser,
  isLocalSessionEnabled,
  isProduction,
  isValidEmail,
  normalizeEmail,
  sanitizeUserName,
  signSessionCookie,
  validateAuthSecret,
  validateDatabaseUrl,
  validateProductionSessionConfig,
} from "@/lib/auth";
import {
  AuthRateLimitError,
  requestLoginOtp,
  rotateRequestSession,
  verifyLoginOtp,
} from "@/lib/verified-auth";

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function jsonError(error: string, status = 500, headers?: HeadersInit) {
  return NextResponse.json({ success: false, error }, { status, headers });
}

function setSessionCookie(response: NextResponse, value: string) {
  response.cookies.set({
    name: "rudyo_session",
    value,
    httpOnly: true,
    path: "/",
    sameSite: "strict",
    secure: isProduction(),
    maxAge: SESSION_MAX_AGE_SECONDS,
    priority: "high",
  });
}

function sessionResponse(
  user: {
    id: string;
    email: string;
    name: string | null;
    plan?: string;
    creditsRemaining: number;
    creditsTotal?: number;
    creditsUsed?: number;
  },
  sessionToken?: string,
) {
  const response = NextResponse.json({
    success: true,
    authenticated: true,
    user: { id: user.id, email: user.email, name: user.name, plan: user.plan ?? "FREE" },
    credits: {
      balance: user.creditsRemaining,
      total: user.creditsTotal ?? user.creditsRemaining,
      used: user.creditsUsed ?? 0,
    },
  });
  if (sessionToken) setSessionCookie(response, sessionToken);
  return response;
}

function rateLimitResponse(error: AuthRateLimitError) {
  return jsonError(error.message, 429, { "Retry-After": String(Math.max(1, error.retryAfterSeconds)) });
}

async function validatePersistentAuth() {
  validateProductionSessionConfig();
  validateAuthSecret();
  validateDatabaseUrl();
  await assertDatabaseConnection();
}

export async function handleSessionPost(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { email?: string; name?: string } | null;
    const email = normalizeEmail(body?.email ?? "");
    const name = sanitizeUserName(body?.name);
    if (!isValidEmail(email)) return jsonError("Adresse e-mail invalide.", 400);

    if (isLocalSessionEnabled()) {
      validateAuthSecret();
      const user = createLocalSessionUser(email, name);
      return sessionResponse(user, signSessionCookie(user.id, {
        email: user.email,
        name: user.name,
        local: true,
      }));
    }

    await validatePersistentAuth();
    await requestLoginOtp(req, email, name);
    return NextResponse.json(
      {
        success: true,
        challengeRequired: true,
        message: "Si l’adresse est valide, un code de connexion vient d’être envoyé.",
      },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof AuthRateLimitError) return rateLimitResponse(error);
    return jsonError("Impossible d’envoyer le code de connexion pour le moment.", 503);
  }
}

export async function handleSessionVerify(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { email?: string; otp?: string } | null;
    const email = normalizeEmail(body?.email ?? "");
    const otp = String(body?.otp ?? "").trim();
    if (!isValidEmail(email) || !/^\d{6}$/.test(otp)) {
      return jsonError("Code invalide ou expiré.", 400);
    }
    await validatePersistentAuth();
    const { user, rawSessionToken } = await verifyLoginOtp(req, email, otp);
    return sessionResponse(user, rawSessionToken);
  } catch (error) {
    if (error instanceof AuthRateLimitError) return rateLimitResponse(error);
    return jsonError("Code invalide ou expiré.", 401);
  }
}

export async function handleSessionGet(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return jsonError("Aucune session vérifiée active.", 401);
    const rotatedToken = user.localSession ? null : await rotateRequestSession(req);
    return sessionResponse(user, rotatedToken ?? undefined);
  } catch {
    return jsonError("Impossible de vérifier la session.", 500);
  }
}
