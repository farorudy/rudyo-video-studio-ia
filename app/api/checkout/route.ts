import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY est manquante");
  }

  return new Stripe(secretKey, {
    apiVersion: "2026-04-22.dahlia",
  });
}

// Catalogue des produits — prix en centimes (EUR)
const PRODUCTS: Record<
  string,
  { name: string; amount: number; description: string }
> = {
  express: {
    name: "Pack Vidéo IA Express",
    amount: 9900,
    description:
      "Vidéo animée 30 s · tous formats · sous-titres · livraison 48 h",
  },
  flyer: {
    name: "Pack Flyer Animé Événement",
    amount: 3900,
    description: "Animation d'affiche événement · format réseaux sociaux",
  },
  promo: {
    name: "Pack Vidéo Promo Formation",
    amount: 12000,
    description: "Présentation formation ou service · durée 1 min",
  },
  lyrics: {
    name: "Pack Clip Lyrics Créole/Français",
    amount: 25000,
    description: "Clip lyrics animé · sous-titres synchronisés · 2-4 min",
  },
  storyboard: {
    name: "Pack Storyboard Clip Musical",
    amount: 8000,
    description: "Découpage narratif + plans organisés pour clip musical",
  },
  moodle: {
    name: "Pack Capsule Pédagogique Moodle",
    amount: 25000,
    description: "Capsule vidéo intégrable Moodle · sous-titres · chapitrage",
  },
  clip: {
    name: "Pack Clip Semi-IA Complet",
    amount: 50000,
    description:
      "Clip professionnel complet avec storyboard IA + montage FFmpeg",
  },
  starter: {
    name: "Abonnement Starter",
    amount: 9900,
    description: "2 vidéos/mois · 30 s chacune · formats réseaux sociaux",
  },
  pro: {
    name: "Abonnement Pro",
    amount: 24900,
    description: "6 vidéos/mois · durées variables · sous-titres inclus",
  },
  premium: {
    name: "Abonnement Premium",
    amount: 49900,
    description: "12 vidéos/mois · clips + capsules + promos · prioritaire",
  },
  iapwsh_50: {
    name: "Credits iApwsh - Pack 50",
    amount: 1000,
    description: "Recharge de 50 credits iApwsh",
  },
  iapwsh_150: {
    name: "Credits iApwsh - Pack 150",
    amount: 2500,
    description: "Recharge de 150 credits iApwsh",
  },
  iapwsh_400: {
    name: "Credits iApwsh - Pack 400",
    amount: 6000,
    description: "Recharge de 400 credits iApwsh",
  },
};

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripeClient();
    const { productId } = await req.json();

    const product = PRODUCTS[productId];
    if (!product) {
      return NextResponse.json(
        { error: "Produit introuvable" },
        { status: 400 },
      );
    }

    const origin =
      req.headers.get("origin") ??
      process.env.NEXT_PUBLIC_URL ??
      "https://rudyo-video-studio.vercel.app";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: product.name,
              description: product.description,
            },
            unit_amount: product.amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/offres/succes?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/offres/annule`,
      metadata: { productId },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    if (err instanceof Error && err.message.includes("STRIPE_SECRET_KEY")) {
      console.error(
        "Configuration error: STRIPE_SECRET_KEY manquante. Configurez les variables Stripe sur Vercel ou dans .env.local",
      );
      return NextResponse.json(
        {
          error: "Paiement indisponible. Configuration Stripe manquante.",
          dev_note:
            "Vérifiez STRIPE_SECRET_KEY dans les variables d'environnement",
        },
        { status: 503 },
      );
    }
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Erreur lors de la création du paiement" },
      { status: 500 },
    );
  }
}
