import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY est manquante");
  }

  return new Stripe(secretKey, {
    apiVersion: "2026-04-22.dahlia",
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const headersList = await headers();
    const sig = headersList.get("stripe-signature");

    if (
      !sig ||
      !process.env.STRIPE_WEBHOOK_SECRET ||
      !process.env.STRIPE_SECRET_KEY
    ) {
      console.warn(
        "Webhook incomplete: missing signature, webhook secret, or API key",
      );
      return NextResponse.json(
        { error: "Signature manquante ou configuration incomplète" },
        { status: 400 },
      );
    }

    const stripe = getStripeClient();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      console.error("Webhook signature error:", err);
      return NextResponse.json(
        { error: "Signature invalide" },
        { status: 400 },
      );
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log("Paiement reçu ✅", {
        productId: session.metadata?.productId,
        amount: session.amount_total,
        email: session.customer_details?.email,
      });
      // TODO: envoyer email de confirmation, créer commande en base, etc.
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    if (err instanceof Error && err.message.includes("STRIPE_SECRET_KEY")) {
      console.error(
        "Configuration error: STRIPE_SECRET_KEY manquante pour webhook Stripe",
      );
      return NextResponse.json(
        { error: "Configuration Stripe incomplète" },
        { status: 503 },
      );
    }
    console.error("Webhook error:", err);
    return NextResponse.json(
      { error: "Erreur lors du traitement du webhook" },
      { status: 500 },
    );
  }
}
