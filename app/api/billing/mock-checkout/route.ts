import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { quoteClip } from "@/lib/tiktok-offer";
import { type AutomaticClipPlanCode } from "@/lib/clip-pricing";
import { calculateMissingClipCredits } from "@/lib/clip-topup";
import { POST as processStripeWebhook } from "@/app/api/billing/webhook/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production" || process.env.STRIPE_MOCK_MODE !== "true") {
    return NextResponse.json({ error: "Simulation indisponible." }, { status: 404 });
  }
  const user = await getCurrentUser(request);
  if (!user || user.localSession) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const projectId = request.nextUrl.searchParams.get("projectId") || "";
  const suppliedSignature = request.nextUrl.searchParams.get("signature") || "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";
  const expectedSignature = createHmac("sha256", webhookSecret).update(`${projectId}.${user.id}`).digest("hex");
  if (!webhookSecret || !safeEqual(suppliedSignature, expectedSignature)) {
    return NextResponse.json({ error: "Signature de simulation invalide." }, { status: 401 });
  }

  const [project, current] = await Promise.all([
    prisma.videoProject.findFirst({ where: { id: projectId, userId: user.id, status: "DRAFT", clipPlan: { not: null } } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { creditsRemaining: true } }),
  ]);
  if (!project || !current || !project.clipPlan || project.clipPlan === "CUSTOM") {
    return NextResponse.json({ error: "Brouillon de clip introuvable." }, { status: 404 });
  }
  const quote = quoteClip(project.billedDurationSeconds || project.durationSeconds || 0, 0, project.clipPlan as AutomaticClipPlanCode);
  const topUp = calculateMissingClipCredits(quote.totalCredits, current.creditsRemaining);
  const stableId = createHash("sha256").update(`${user.id}:${project.id}`).digest("hex").slice(0, 24);
  const event = {
    id: `evt_mock_${stableId}`,
    object: "event",
    api_version: "2025-12-15.clover",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_test_mock_${stableId}`,
        object: "checkout.session",
        mode: "payment",
        payment_status: "paid",
        amount_total: topUp.priceInCents,
        currency: "eur",
        customer: null,
        customer_details: { email: user.email },
        metadata: {
          userId: user.id,
          productId: "clip_missing_credits",
          mode: "clip_topup",
          tokens: String(topUp.purchasedCredits),
          projectId: project.id,
          normalizedSeconds: String(quote.normalizedSeconds),
          plan: quote.plan,
          requiredCredits: String(quote.totalCredits),
          balanceAtCheckout: String(current.creditsRemaining),
        },
      },
    },
  };
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const stripeSignature = createHmac("sha256", webhookSecret).update(`${timestamp}.${body}`).digest("hex");
  const webhookRequest = new NextRequest(new URL("/api/billing/webhook", request.nextUrl.origin), {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": `t=${timestamp},v1=${stripeSignature}` },
    body,
  });
  const webhookResponse = await processStripeWebhook(webhookRequest);
  if (!webhookResponse.ok) return NextResponse.json({ error: "La confirmation simulée a échoué." }, { status: 500 });
  const destination = new URL("/", request.nextUrl.origin);
  destination.searchParams.set("resumeProjectId", project.id);
  destination.searchParams.set("payment", "success");
  return NextResponse.redirect(destination);
}
