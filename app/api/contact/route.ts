import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendContactNotification } from "@/lib/contact-email";
import {
  beginIdempotentRequest,
  clientIp,
  clientIpHash,
  enforceApiRateLimit,
  finishIdempotentRequest,
  readJsonWithLimit,
  requireIdempotencyKey,
  withTimeout,
} from "@/lib/request-security";

const clean = (max: number) => z.string().trim().max(max).transform((value) => value.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " "));
const schema = z.object({
  prenom: clean(80).pipe(z.string().min(1)),
  nom: clean(80).pipe(z.string().min(1)),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  telephone: clean(40).optional(),
  typeVideo: clean(100).pipe(z.string().min(1)),
  objectif: clean(1_000).pipe(z.string().min(2)),
  dateLimite: clean(20).optional(),
  budget: clean(40).optional(),
  fichiers: clean(1_000).optional(),
  message: clean(4_000).optional(),
  turnstileToken: z.string().min(10).max(2_048),
}).strict();

async function verifyTurnstile(token: string, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new Error("CAPTCHA non configuré.");
  const response = await withTimeout(fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    cache: "no-store",
  }), 10_000);
  const result = await response.json() as { success?: boolean };
  return response.ok && result.success === true;
}

export async function POST(request: NextRequest) {
  let idempotencyId: string | null = null;
  try {
    const ip = clientIp(request);
    await enforceApiRateLimit(request, "contact", `anonymous:${ip}`, 5, 60 * 60_000);
    const key = requireIdempotencyKey(request);
    const idempotency = await beginIdempotentRequest("contact", `anonymous:${ip}`, key);
    idempotencyId = idempotency.record.id;
    if (!idempotency.fresh) {
      if (idempotency.record.responseCode && idempotency.record.response) return NextResponse.json(idempotency.record.response, { status: idempotency.record.responseCode });
      return NextResponse.json({ error: "Cette demande est déjà en cours." }, { status: 409 });
    }
    const parsed = schema.safeParse(await readJsonWithLimit<unknown>(request, 16 * 1024));
    if (!parsed.success) throw new Error("Les informations du devis sont invalides.");
    if (!(await verifyTurnstile(parsed.data.turnstileToken, ip))) throw new Error("La vérification anti-robot a échoué.");
    const saved = await prisma.contactRequest.create({
      data: {
        name: `${parsed.data.prenom} ${parsed.data.nom}`,
        email: parsed.data.email,
        phone: parsed.data.telephone || null,
        videoType: parsed.data.typeVideo,
        objective: parsed.data.objectif,
        deadline: parsed.data.dateLimite || null,
        budget: parsed.data.budget || null,
        filesNote: parsed.data.fichiers || null,
        message: parsed.data.message || null,
        ipHash: clientIpHash(request),
      },
      select: { id: true },
    });
    try {
      await sendContactNotification({
        requestId: saved.id,
        name: `${parsed.data.prenom} ${parsed.data.nom}`,
        email: parsed.data.email,
        phone: parsed.data.telephone,
        videoType: parsed.data.typeVideo,
        objective: parsed.data.objectif,
        deadline: parsed.data.dateLimite,
        budget: parsed.data.budget,
        filesNote: parsed.data.fichiers,
        message: parsed.data.message,
      });
      await prisma.contactRequest.update({ where: { id: saved.id }, data: { status: "NOTIFIED" } });
    } catch {
      await prisma.contactRequest.update({ where: { id: saved.id }, data: { status: "EMAIL_FAILED" } });
      throw new Error("La demande a été sauvegardée, mais sa transmission a échoué. Réessayez avec le même identifiant.");
    }
    const response = { success: true, message: "Demande enregistrée.", requestId: saved.id };
    await finishIdempotentRequest(idempotency.record.id, 201, response);
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && (error.message.includes("anti-robot") || error.message.includes("invalides") || error.message.includes("transmission"))
      ? error.message : "Impossible d’enregistrer la demande pour le moment.";
    if (idempotencyId) await finishIdempotentRequest(idempotencyId, 400, { error: message }).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
