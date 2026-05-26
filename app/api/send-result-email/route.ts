import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getCurrentUser, isValidEmail, normalizeEmail } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SendResultEmailBody = {
  to?: string;
  videoUrl?: string;
  title?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function appUrl(req: NextRequest) {
  const configured =
    process.env.NEXT_PUBLIC_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    req.nextUrl.origin;

  return configured.startsWith("http") ? configured : `https://${configured}`;
}

function isAllowedVideoUrl(value: string, req: NextRequest) {
  try {
    const parsed = new URL(value, req.nextUrl.origin);
    const appOrigin = new URL(appUrl(req)).origin;
    return parsed.origin === appOrigin || parsed.protocol === "data:";
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Utilisateur non authentifie. Connectez-vous avant l'envoi.",
        },
        { status: 401 },
      );
    }

    const body = (await req.json()) as SendResultEmailBody;
    const to = normalizeEmail(body.to || user.email);
    const videoUrl = body.videoUrl?.trim();
    const title = body.title?.trim() || "Video Rudyo";

    if (!isValidEmail(to)) {
      return NextResponse.json(
        { success: false, error: "Adresse email destinataire invalide." },
        { status: 400 },
      );
    }

    if (!videoUrl) {
      return NextResponse.json(
        { success: false, error: "Lien video manquant." },
        { status: 400 },
      );
    }

    if (!isAllowedVideoUrl(videoUrl, req)) {
      return NextResponse.json(
        { success: false, error: "Lien video non autorise." },
        { status: 400 },
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "RESEND_API_KEY manquante. Configurez cette variable dans Vercel pour envoyer l'email.",
        },
        { status: 500 },
      );
    }

    const resend = new Resend(apiKey);
    const from =
      process.env.RESULT_EMAIL_FROM ||
      "Farozik Rudyo <onboarding@resend.dev>";
    const baseUrl = appUrl(req);
    const recipientName = escapeHtml(user.name || "Rudy");
    const safeTitle = escapeHtml(title);
    const safeVideoUrl = escapeHtml(videoUrl);
    const safeBaseUrl = escapeHtml(baseUrl);

    const result = await resend.emails.send({
      from,
      to,
      subject: `Votre video Rudyo est prete - ${title}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h1>Votre video Rudyo est prete</h1>
          <p>Bonjour ${recipientName},</p>
          <p>La video <strong>${safeTitle}</strong> a ete generee avec Farozik - Rudyo Video Studio IA.</p>
          <p>
            <a href="${safeVideoUrl}" style="display:inline-block;background:#22d3ee;color:#0f172a;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">
              Ouvrir la video
            </a>
          </p>
          <p>Lien direct : <br><a href="${safeVideoUrl}">${safeVideoUrl}</a></p>
          <p>Application : <a href="${safeBaseUrl}">${safeBaseUrl}</a></p>
        </div>
      `,
      text: `Votre video Rudyo est prete: ${videoUrl}\nApplication: ${baseUrl}`,
    });

    return NextResponse.json({
      success: true,
      id: result.data?.id,
      to,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur email inconnue.";
    console.error("[rudyo-email] erreur", { message });

    return NextResponse.json(
      {
        success: false,
        error: `Impossible d'envoyer l'email : ${message}`,
      },
      { status: 500 },
    );
  }
}
