import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  getAdminFromRequest,
  isSameOriginRequest,
  verifyAdminCredentials,
} from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clearAdminCookie(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export async function GET(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, authenticated: false },
      { status: 401 },
    );
  }

  return NextResponse.json({
    success: true,
    authenticated: true,
    admin: { email: admin.email },
  });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { success: false, error: "Origine de requête invalide." },
      { status: 403 },
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      email?: string;
      password?: string;
    } | null;
    const admin = verifyAdminCredentials(
      body?.email ?? "",
      body?.password ?? "",
    );

    if (!admin) {
      await new Promise((resolve) => setTimeout(resolve, 450));
      return NextResponse.json(
        { success: false, error: "Identifiants administrateur invalides." },
        { status: 401 },
      );
    }

    const response = NextResponse.json({
      success: true,
      authenticated: true,
      admin: { email: admin.email },
    });
    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: createAdminSessionToken(admin),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    console.error("[rudyo-admin] configuration invalide", {
      message: error instanceof Error ? error.message : "Erreur inconnue",
    });
    return NextResponse.json(
      {
        success: false,
        error: "L'administration n'est pas encore configurée sur le serveur.",
      },
      { status: 503 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { success: false, error: "Origine de requête invalide." },
      { status: 403 },
    );
  }

  const response = NextResponse.json({ success: true });
  clearAdminCookie(response);
  return response;
}
