import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateUserByEmail,
  signSessionCookie,
  requireAuthSecret,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    requireAuthSecret();
    const body = (await req.json()) as { email?: string; name?: string };
    const email = body.email?.trim();
    const name = body.name?.trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Veuillez saisir une adresse email valide." },
        { status: 400 },
      );
    }

    const user = await getOrCreateUserByEmail(email, name);
    const sessionValue = signSessionCookie(user.id);
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
      },
    });
    response.cookies.set({
      name: "rudyo_session",
      value: sessionValue,
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Impossible de créer votre session. Réessayez." },
      { status: 500 },
    );
  }
}
