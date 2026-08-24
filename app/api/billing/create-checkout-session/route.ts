import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { beginIdempotentRequest, enforceApiRateLimit, finishIdempotentRequest, readJsonWithLimit, requireIdempotencyKey } from "@/lib/request-security";
import { getCreditPack, getStripeClient, getStripeProductDescription, getStripeProductName, getSubscriptionPlan } from "@/lib/stripe";
import { getClipEconomics, quoteClip } from "@/lib/tiktok-offer";
import { calculateMissingClipCredits } from "@/lib/clip-topup";
import { type AutomaticClipPlanCode } from "@/lib/clip-pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const checkoutSchema = z.object({
  productId: z.string().trim().min(1).max(100).optional(),
  projectId: z.string().trim().min(1).max(100).optional(),
  mode: z.enum(["credit", "subscription", "clip_topup"]),
}).strict().superRefine((value, context) => {
  if (value.mode === "clip_topup" && !value.projectId) context.addIssue({ code: "custom", message: "projectId requis" });
  if (value.mode !== "clip_topup" && !value.productId) context.addIssue({ code: "custom", message: "productId requis" });
});

function getCheckoutOrigin(req: NextRequest) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_URL;
  const fallbackOrigin = "https://rudyoai.com";
  return process.env.NODE_ENV === "production" ? configuredOrigin ?? fallbackOrigin : req.headers.get("origin") ?? configuredOrigin ?? fallbackOrigin;
}

export async function POST(req: NextRequest) {
  let idempotencyId: string | null = null;
  try {
    const user = await getCurrentUser(req);
    if (!user || user.localSession) return NextResponse.json({ error: "Connectez-vous avec un compte Rudyo persistant avant d’acheter des crédits." }, { status: 401 });
    await enforceApiRateLimit(req, "stripe-checkout", user.id, 10, 60 * 60_000);
    const key = requireIdempotencyKey(req);
    const requestState = await beginIdempotentRequest("stripe-checkout", user.id, key);
    idempotencyId = requestState.record.id;
    if (!requestState.fresh) {
      if (requestState.record.response && requestState.record.responseCode) return NextResponse.json(requestState.record.response, { status: requestState.record.responseCode });
      return NextResponse.json({ error: "Création déjà en cours." }, { status: 409 });
    }

    const parsed = checkoutSchema.safeParse(await readJsonWithLimit<unknown>(req, 8 * 1024));
    if (!parsed.success) {
      const response = { error: "Paramètres de paiement invalides." };
      await finishIdempotentRequest(idempotencyId, 400, response);
      return NextResponse.json(response, { status: 400 });
    }

    const origin = getCheckoutOrigin(req);
    const isTopUp = parsed.data.mode === "clip_topup";
    const isSubscription = parsed.data.mode === "subscription";
    const productId = parsed.data.productId || "clip_missing_credits";
    let productName: string;
    let productDescription: string;
    let unitAmount: number;
    let tokens = 0;
    let successUrl = `${origin}/offres/succes?session_id={CHECKOUT_SESSION_ID}`;
    let cancelUrl = `${origin}/offres/annule`;
    let clipMetadata: Record<string, string> = {};

    if (isTopUp) {
      const project = await prisma.videoProject.findFirst({
        where: { id: parsed.data.projectId, userId: user.id, status: "DRAFT", clipPlan: { not: null } },
        select: { id: true, billedDurationSeconds: true, durationSeconds: true, clipPlan: true },
      });
      if (!project) throw new Error("Brouillon de clip introuvable.");
      if (!project.clipPlan || project.clipPlan === "CUSTOM") throw new Error("Cette formule n’est pas disponible.");
      const selectedPlan = project.clipPlan as AutomaticClipPlanCode;
      const quote = quoteClip(project.billedDurationSeconds || project.durationSeconds || 0, 0, selectedPlan);
      const economics = getClipEconomics(quote.normalizedSeconds, selectedPlan);
      if (!quote.supported || !quote.fitsSelectedPlan || !economics.enabled) throw new Error("Cette formule n’est pas disponible.");
      const current = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { creditsRemaining: true } });
      tokens = calculateMissingClipCredits(quote.totalCredits, current.creditsRemaining).missingCredits;
      if (tokens <= 0) {
        const response = { error: "Votre solde couvre déjà ce projet.", projectId: project.id, missingCredits: 0 };
        await finishIdempotentRequest(idempotencyId, 409, response);
        return NextResponse.json(response, { status: 409 });
      }
      unitAmount = tokens;
      productName = `Recharge exacte · ${quote.planName}`;
      productDescription = `${tokens.toLocaleString("fr-FR")} crédits manquants pour reprendre votre projet Rudyo.`;
      successUrl = `${origin}/offres/succes?session_id={CHECKOUT_SESSION_ID}&projectId=${encodeURIComponent(project.id)}`;
      cancelUrl = `${origin}/?resumeProjectId=${encodeURIComponent(project.id)}`;
      clipMetadata = {
        projectId: project.id,
        normalizedSeconds: String(quote.normalizedSeconds),
        plan: quote.plan,
        requiredCredits: String(quote.totalCredits),
        balanceAtCheckout: String(current.creditsRemaining),
      };
    } else {
      const creditPack = getCreditPack(productId);
      const subscription = getSubscriptionPlan(productId);
      const product = creditPack || subscription;
      if (!product || (isSubscription && !subscription) || (!isSubscription && !creditPack)) {
        const response = { error: "Produit introuvable." };
        await finishIdempotentRequest(idempotencyId, 400, response);
        return NextResponse.json(response, { status: 400 });
      }
      unitAmount = creditPack?.amount ?? subscription!.price;
      tokens = creditPack?.credits ?? 0;
      productName = getStripeProductName(productId);
      productDescription = getStripeProductDescription(productId);
    }

    const stripe = getStripeClient();
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({ email: user.email, name: user.name ?? undefined, metadata: { userId: user.id, app: "rudyo-video-studio-ia" } }, { idempotencyKey: `rudyo-customer-${user.id}` });
      stripeCustomerId = customer.id;
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId } });
    }

    const mode = isTopUp ? "clip_topup" : isSubscription ? "subscription" : "credit";
    const metadata = { userId: user.id, productId, mode, tokens: String(tokens), app: "rudyo-video-studio-ia", ...clipMetadata };
    const lineItem = {
      price_data: {
        currency: "eur",
        product_data: { name: productName, description: productDescription },
        unit_amount: unitAmount,
        ...(isSubscription ? { recurring: { interval: "month" as const } } : {}),
      },
      quantity: 1,
    };
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [lineItem],
      mode: isSubscription ? "subscription" : "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: isSubscription ? { ...metadata, plan: productId } : metadata,
      allow_promotion_codes: isTopUp ? false : true,
      customer: stripeCustomerId,
      client_reference_id: user.id,
    }, { idempotencyKey: isTopUp ? `rudyo-clip-topup-${user.id}-${parsed.data.projectId}` : `rudyo-checkout-${user.id}-${productId}-${key}` });

    const response = { url: session.url };
    await finishIdempotentRequest(idempotencyId, 200, response);
    return NextResponse.json(response);
  } catch (error) {
    console.error("Create checkout session error:", error);
    const response = { error: error instanceof Error && ["Brouillon de clip introuvable.", "Cette formule n’est pas disponible."].includes(error.message) ? error.message : "Impossible de créer la session de paiement." };
    if (idempotencyId) await finishIdempotentRequest(idempotencyId, 500, response).catch(() => undefined);
    return NextResponse.json(response, { status: 500 });
  }
}
