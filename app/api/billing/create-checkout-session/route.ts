import { NextRequest, NextResponse } from "next/server";
import {
  getStripeClient,
  getCreditPack,
  getSubscriptionPlan,
  getStripeProductName,
  getStripeProductDescription,
} from "@/lib/stripe";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      productId: string;
      mode?: "credit" | "subscription";
      email?: string;
    };
    const { productId, mode, email } = body;
    const product = getCreditPack(productId) || getSubscriptionPlan(productId);
    if (!product) {
      return NextResponse.json(
        { error: "Produit introuvable." },
        { status: 400 },
      );
    }

    const stripe = getStripeClient();
    const user = await getCurrentUser(req);
    const origin =
      req.headers.get("origin") ??
      process.env.NEXT_PUBLIC_URL ??
      "https://rudyo-video-studio.vercel.app";
    const metadata = {
      productId,
      mode:
        mode ?? (getSubscriptionPlan(productId) ? "subscription" : "credit"),
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

    const lineItem = {
      price_data: {
        currency: "eur",
        product_data: {
          name: getStripeProductName(productId),
          description: getStripeProductDescription(productId),
        },
        unit_amount: unitAmount,
        recurring: isSubscription ? { interval: "month" } : undefined,
      },
      quantity: 1,
    } as const;

    const sessionCreate: Record<string, unknown> = {
      payment_method_types: ["card"],
      line_items: [lineItem],
      mode: getSubscriptionPlan(productId) ? "subscription" : "payment",
      success_url: `${origin}/offres/succes?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/offres/annule`,
      metadata,
      allow_promotion_codes: true,
    };

    if (user?.stripeCustomerId) {
      sessionCreate.customer = user.stripeCustomerId;
    } else if (user?.email) {
      sessionCreate.customer_email = user.email;
    } else if (email) {
      sessionCreate.customer_email = email.trim().toLowerCase();
    }

    if (getSubscriptionPlan(productId)) {
      sessionCreate.metadata = {
        ...metadata,
        plan: productId,
      };
    } else {
      sessionCreate.metadata = metadata;
    }

    const session = await stripe.checkout.sessions.create(sessionCreate as any);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Create checkout session error:", error);
    return NextResponse.json(
      { error: "Impossible de créer la session de paiement." },
      { status: 500 },
    );
  }
}
