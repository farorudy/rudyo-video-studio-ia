import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const SECRET = process.env.API_KEY_ENCRYPTION_SECRET || "";

function getSecretKey() {
  if (!SECRET || SECRET.length < 32) {
    throw new Error(
      "API_KEY_ENCRYPTION_SECRET doit être défini et contenir au moins 32 caractères.",
    );
  }
  return Buffer.from(SECRET.slice(0, 32), "utf8");
}

function encryptApiKey(key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getSecretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${encrypted.toString("base64")}:${authTag.toString("base64")}`;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json(
      { error: "Utilisateur non authentifié." },
      { status: 401 },
    );
  }

  return NextResponse.json({ hasApiKey: Boolean(user.apiKey) });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json(
      { error: "Utilisateur non authentifié." },
      { status: 401 },
    );
  }

  const body = (await req.json()) as { apiKey?: string };
  const apiKey = body.apiKey?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Clé API manquante." }, { status: 400 });
  }

  const encrypted = encryptApiKey(apiKey);
  await prisma.user.update({
    where: { id: user.id },
    data: { apiKey: encrypted },
  });
  return NextResponse.json({
    success: true,
    message: "Clé IA personnelle enregistrée.",
  });
}
