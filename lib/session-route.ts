import { NextRequest, NextResponse } from "next/server";
import {
  assertDatabaseConnection,
  createLocalSessionUser,
  getCurrentUser,
  getOrCreateUserByEmail,
  isLocalSessionEnabled,
  isProduction,
  isValidEmail,
  normalizeEmail,
  requireAuthSecret,
  sanitizeUserName,
  signSessionCookie,
  validateDatabaseUrl,
  validateProductionSessionConfig,
} from "@/lib/auth";

function logStep(step: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.info("[rudyo-session]", step, details ?? {});
  }
}

function jsonError(error: string, status = 500) {
  return NextResponse.json({ success: false, error }, { status });
}

function createSessionResponse(user: {
  id: string;
  email: string;
  name: string | null;
  plan?: string;
  creditsRemaining: number;
  creditsTotal?: number;
  creditsUsed?: number;
  localSession?: boolean;
}) {
  const sessionValue = signSessionCookie(user.id, {
    email: user.email,
    name: user.name,
    local: user.localSession,
  });

  const response = NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan ?? "FREE",
    },
    credits: {
      balance: user.creditsRemaining,
      total: user.creditsTotal ?? user.creditsRemaining,
      used: user.creditsUsed ?? 0,
    },
  });

  response.cookies.set({
    name: "rudyo_session",
    value: sessionValue,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isProduction(),
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}

export async function handleSessionPost(req: NextRequest) {
  logStep("route appelee", { path: req.nextUrl.pathname });

  try {
    const authSecret = process.env.AUTH_COOKIE_SECRET?.trim();
    const databaseUrl = process.env.DATABASE_URL?.trim();
    validateProductionSessionConfig();
    const localSession = isLocalSessionEnabled();

    logStep("configuration detectee", {
      authSecretPresent: Boolean(authSecret),
      authSecretValidLength: (authSecret ?? "").length >= 32,
      databaseUrlPresent: Boolean(databaseUrl),
      localSession,
      useLocalSessionRequested: process.env.USE_LOCAL_SESSION === "true",
      localSessionIgnoredInProduction:
        process.env.USE_LOCAL_SESSION === "true" && isProduction(),
      nodeEnv: process.env.NODE_ENV,
    });

    try {
      requireAuthSecret();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Configuration serveur incomplète : AUTH_COOKIE_SECRET manquant ou invalide.";
      console.error("[rudyo-session] auth config error", { message });
      return jsonError(
        "Configuration serveur incomplète. Veuillez contacter l'administrateur.",
        500,
      );
    }

    const body = (await req.json().catch(() => null)) as {
      email?: string;
      name?: string;
    } | null;
    const email = normalizeEmail(body?.email ?? "");
    const name = sanitizeUserName(body?.name);

    logStep("payload recu", {
      email,
      namePresent: Boolean(name),
    });

    if (!email) {
      return jsonError("Veuillez saisir votre adresse email.", 400);
    }

    if (!isValidEmail(email)) {
      return jsonError("Adresse email invalide.", 400);
    }

    if (localSession) {
      logStep("mode local actif", { email });
      const user = createLocalSessionUser(email, name);
      logStep("session locale creee", {
        email: user.email,
        creditsRemaining: user.creditsRemaining,
      });
      const response = createSessionResponse(user);
      logStep("cookie de session cree", {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAgeDays: 30,
      });
      return response;
    }

    try {
      validateDatabaseUrl();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Configuration serveur incomplète : DATABASE_URL manquant ou invalide.";
      console.error("[rudyo-session] database config error", { message });
      return jsonError(
        "Configuration serveur incomplète. Veuillez contacter l'administrateur.",
        500,
      );
    }

    logStep("connexion base de donnees");
    await assertDatabaseConnection();

    logStep("creation ou recuperation utilisateur", { email });
    const user = await getOrCreateUserByEmail(email, name);
    logStep("utilisateur pret", {
      id: user.id,
      email: user.email,
      creditsRemaining: user.creditsRemaining,
    });

    const response = createSessionResponse(user);
    logStep("cookie de session cree", {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction(),
      maxAgeDays: 30,
    });
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur serveur inconnue.";
    console.error("[rudyo-session] erreur serveur", {
      message,
      name: error instanceof Error ? error.name : "UnknownError",
    });

    if (
      message.toLowerCase().includes("database") ||
      message.toLowerCase().includes("prisma") ||
      message.toLowerCase().includes("connect")
    ) {
      return jsonError(
        "Impossible de créer votre compte pour le moment. Réessayez plus tard.",
        500,
      );
    }

    return jsonError("Impossible de créer votre session. Réessayez.", 500);
  }
}

export async function handleSessionGet(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          error:
            "Aucune session active. Utilisez POST /api/session pour vous connecter.",
        },
        { status: 401 },
      );
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
      },
      credits: {
        balance: user.creditsRemaining,
        total: user.creditsTotal,
        used: user.creditsUsed,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur serveur inconnue.";
    console.error("[rudyo-session] erreur lecture session", {
      message,
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return jsonError(message, 500);
  }
}
