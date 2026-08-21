import { NextRequest, NextResponse } from "next/server";
import { revokeRequestSession } from "@/lib/verified-auth";

export async function POST(request: NextRequest) {
  await revokeRequestSession(request);
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: "rudyo_session",
    value: "",
    httpOnly: true,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    priority: "high",
  });
  return response;
}
