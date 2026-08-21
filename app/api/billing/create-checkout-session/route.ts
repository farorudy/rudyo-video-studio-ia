import { NextRequest, NextResponse } from "next/server";
import {
  getStripeClient,
  getCreditPack,
  getSubscriptionPlan,
  getStripeProductName,
  getStripeProductDescription,
} from "@/lib/stripe";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  beginIdempotentRequest,
  enforceApiRateLimit,
  finishIdempotentRequest,
  readJsonWithLimit,
  requireIdempotencyKey,
} from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const checkoutSchema = z.object({
  productId: z.string().trim().min(1).max(100),
  mode: z.enum(["credit", "subscription"]).optional(),
}).strict();

function getCheckoutOrigin(req: NextRequest) {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_URL;
  const fallbackOrigin = "https://rudyo-video-studio.vercel.app";

  if (process.env.NODE_ENV === "production") {
    return configuredOrigin ?? fallbackOrigin;
  }

  return req.headers.get("origin") ?? configuredOrigin ?? fallbackOrigin;
}

export async function POST(req: NextRequest) {
  let idempotencyId: string | null = null;
  try {
    const user = await getCurrentUser(req);
    if (!user || user.localSession) {
      return NextResponse.json(
        {
          error:
            "Connectez-vous avec un compte Rudyo persistant avant d'acheter des tokens.",
        },
        { status: 401 },
      );
    }
    await enforceApiRateLimit(req, "stripe-checkout", user.id, 10, 60 * 60_000);
    const key = requireIdempotencyKey(req);
    const requestState = await beginIdempotentRequest("stripe-checkout", user.id, key);
    idempotencyId = requestState.record.id;
    if (!requestState.fresh) {
      if (requestState.record.response && requestState.record.responseCode) {
        return NextResponse.json(requestState.record.response, { status: requestState.record.responseCode });
      }
      return NextResponse.json({ error: "Création déjà en cours." }, { status: 409 });
    }
    const parsed = checkoutSchema.safeParse(await readJsonWithLimit<unknown>(req, 8 * 1024));
    if (!parsed.success) {
      const response = { error: "Paramètres de paiement invalides." };
      await finishIdempotentRequest(idempotencyId, 400, response);
      return NextResponse.json(response, { status: 400 });
    }
    const { productId, mode } = parsed.data;
    const product = getCreditPack(productId) || getSubscriptionPlan(productId);
    if (!product) {
      const response = { error: "Produit introuvable." };
      await finishIdempotentRequest(idempotencyId, 400, response);
      return NextResponse.json(response, { status: 400 });
    }

    const stripe = getStripeClient();
    const origin = getCheckoutOrigin(req);
    let stripeCustomerId = user.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create(
        {
          email: user.email,
          name: user.name ?? undefined,
          metadata: { userId: user.id, app: "rudyo-video-studio-ia" },
        },
        { idempotencyKey: `rudyo-customer-${user.id}` },
      );
      stripeCustomerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId },
      });
    }

    const creditPack = getCreditPack(productId);
    const metadata = {
      userId: user.id,
      productId,
      mode:
        mode ?? (getSubscriptionPlan(productId) ? "subscription" : "credit"),
      tokens: creditPack ? String(creditPack.credits) : "",
      app: "rudyo-video-studio-ia",
    };
    const isSubscription = Boolean(getSubscriptionPlan(productId));
    const unitAmount =
      getCreditPack(productId)?.amount ?? getSubscriptionPlan(productId)?.price;

    if (!unitAmount) {
      return NextResponse.json(
        { error: "Produit Stripe invalide." },
        { status: 400 },
      );
    }

    const productData = {
      name: getStripeProductName(productId),
      description: getStripeProductDescription(productId),
    };
    const lineItem = isSubscription
      ? {
          price_data: {
            currency: "eur",
            product_data: productData,
            unit_amount: unitAmount,
            recurring: { interval: "month" as const },
          },
          quantity: 1,
        }
      : {
          price_data: {
            currency: "eur",
            product_data: productData,
            unit_amount: unitAmount,
          },
          quantity: 1,
        };

    const sessionCreate = {
      payment_method_types: ["card"],
      line_items: [lineItem],
      mode: getSubscriptionPlan(productId) ? "subscription" : "payment",
      success_url: `${origin}/offres/succes?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/offres/annule`,
      metadata,
      allow_promotion_codes: true,
      customer: stripeCustomerId,
      client_reference_id: user.id,
    } satisfies Parameters<typeof stripe.checkout.sessions.create>[0];

    if (getSubscriptionPlan(productId)) {
      const subscriptionSession = {
        ...sessionCreate,
        metadata: {
          ...metadata,
          plan: productId,
        },
      };
      const session = await stripe.checkout.sessions.create(subscriptionSession, {
        idempotencyKey: `rudyo-checkout-${user.id}-${key}`,
      });
      const response = { url: session.url };
      await finishIdempotentRequest(idempotencyId, 200, response);
      return NextResponse.json(response);
    }

    const session = await stripe.checkout.sessions.create({
      ...sessionCreate,
      metadata: { ...metadata },
    }, { idempotencyKey: `rudyo-checkout-${user.id}-${key}` });
    const response = { url: session.url };
    await finishIdempotentRequest(idempotencyId, 200, response);
    return NextResponse.json(response);
  } catch (error) {
    console.error("Create checkout session error:", error);
    if (idempotencyId) {
      await finishIdempotentRequest(
        idempotencyId,
        500,
        { error: "Impossible de créer la session de paiement." },
      ).catch(() => undefined);
    }
    return NextResponse.json(
      { error: "Impossible de créer la session de paiement." },
      { status: 500 },
    );
  }
}
