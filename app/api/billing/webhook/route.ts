import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient, getCreditPack } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserByEmail } from "@/lib/auth";

function resolveBillingStatus(
  status: string,
): "ACTIVE" | "PAST_DUE" | "CANCELED" | "INCOMPLETE" | "TRIALING" {
  switch (status) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
    case "unpaid":
      return "CANCELED";
    case "incomplete":
      return "INCOMPLETE";
    default:
      return "ACTIVE";
  }
}

function mapSubscriptionPlan(stripePriceId: string, metadataPlan?: string) {
  if (metadataPlan) {
    if (metadataPlan === "starter_monthly") return "STARTER";
    if (metadataPlan === "createur_monthly") return "CREATOR";
    if (metadataPlan === "studio_monthly") return "STUDIO";
  }
  if (stripePriceId.includes("starter")) {
    return "STARTER";
  }
  if (stripePriceId.includes("createur") || stripePriceId.includes("creator")) {
    return "CREATOR";
  }
  if (stripePriceId.includes("studio")) {
    return "STUDIO";
  }
  return "FREE";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!signature || !webhookSecret) {
      return NextResponse.json(
        { error: "Webhook Stripe non configuré." },
        { status: 400 },
      );
    }

    const stripe = getStripeClient();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Stripe webhook signature invalide", err);
      return NextResponse.json(
        { error: "Signature invalide." },
        { status: 400 },
      );
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};
        const productId = metadata.productId as string | undefined;
        const mode = metadata.mode as string | undefined;
        const email = session.customer_details?.email?.trim().toLowerCase();
        if (!email) {
          console.warn("Checkout session completed without email");
          break;
        }

        const user = await getOrCreateUserByEmail(email);
        if (session.customer) {
          await prisma.user.update({
            where: { id: user.id },
            data: { stripeCustomerId: String(session.customer) },
          });
        }

        if (mode === "credit" && productId) {
          const creditPack = getCreditPack(productId);
          if (creditPack) {
            await prisma.$transaction([
              prisma.creditTransaction.create({
                data: {
                  userId: user.id,
                  type: "PURCHASE",
                  action: "OTHER",
                  creditsAmount: creditPack.credits,
                  description: `Achat de ${creditPack.name}`,
                  status: "CONFIRMED",
                  metadata: {
                    stripeSessionId: session.id,
                    productId,
                  },
                },
              }),
              prisma.user.update({
                where: { id: user.id },
                data: {
                  creditsTotal: { increment: creditPack.credits },
                  creditsRemaining: { increment: creditPack.credits },
                  billingStatus: "ACTIVE",
                },
              }),
            ]);
          }
        }

        if (mode === "subscription" && session.subscription) {
          const stripeSubscriptionId = String(session.subscription);
          const subscription = (await stripe.subscriptions.retrieve(
            stripeSubscriptionId,
            { expand: ["items.data.price.product"] },
          )) as Stripe.Subscription;
          const priceItem = subscription.items.data[0]?.price;
          const plan = mapSubscriptionPlan(
            priceItem?.id ?? "",
            session.metadata?.plan as string,
          );
          const monthlyLimit =
            plan === "STARTER"
              ? 20
              : plan === "CREATOR"
                ? 80
                : plan === "STUDIO"
                  ? 200
                  : 0;

          await prisma.$transaction([
            prisma.subscription.upsert({
              where: { stripeSubscriptionId },
              update: {
                priceId: priceItem?.id ?? "",
                status: resolveBillingStatus(subscription.status),
                plan: plan as any,
                currentPeriodStart: (subscription as any).current_period_start
                  ? new Date((subscription as any).current_period_start * 1000)
                  : undefined,
                currentPeriodEnd: (subscription as any).current_period_end
                  ? new Date((subscription as any).current_period_end * 1000)
                  : undefined,
              },
              create: {
                userId: user.id,
                stripeSubscriptionId,
                priceId: priceItem?.id ?? "",
                plan: plan as any,
                status: resolveBillingStatus(subscription.status),
                currentPeriodStart: (subscription as any).current_period_start
                  ? new Date((subscription as any).current_period_start * 1000)
                  : undefined,
                currentPeriodEnd: (subscription as any).current_period_end
                  ? new Date((subscription as any).current_period_end * 1000)
                  : undefined,
              },
            }),
            prisma.user.update({
              where: { id: user.id },
              data: {
                plan: plan as any,
                monthlyLimit,
                billingStatus: resolveBillingStatus(subscription.status),
              },
            }),
          ]);
        }

        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        if (!customerId) break;
        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: { billingStatus: "ACTIVE" },
        });
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id;
        if (!customerId) break;
        const plan = mapSubscriptionPlan(
          subscription.items.data[0]?.price.id ?? "",
        );
        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            plan: plan as any,
            monthlyLimit:
              plan === "STARTER"
                ? 20
                : plan === "CREATOR"
                  ? 80
                  : plan === "STUDIO"
                    ? 200
                    : 0,
            billingStatus: resolveBillingStatus(subscription.status),
          },
        });
        const linkedUser = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        });
        if (linkedUser) {
          await prisma.subscription.upsert({
            where: { stripeSubscriptionId: subscription.id },
            create: {
              userId: linkedUser.id,
              stripeSubscriptionId: subscription.id,
              priceId: subscription.items.data[0]?.price.id ?? "",
              plan: plan as any,
              status: resolveBillingStatus(subscription.status),
              currentPeriodStart: (subscription as any).current_period_start
                ? new Date((subscription as any).current_period_start * 1000)
                : undefined,
              currentPeriodEnd: (subscription as any).current_period_end
                ? new Date((subscription as any).current_period_end * 1000)
                : undefined,
            },
            update: {
              priceId: subscription.items.data[0]?.price.id ?? "",
              plan: plan as any,
              status: resolveBillingStatus(subscription.status),
              currentPeriodStart: (subscription as any).current_period_start
                ? new Date((subscription as any).current_period_start * 1000)
                : undefined,
              currentPeriodEnd: (subscription as any).current_period_end
                ? new Date((subscription as any).current_period_end * 1000)
                : undefined,
            },
          });
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id;
        if (!customerId) break;
        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: { billingStatus: "CANCELED", plan: "FREE", monthlyLimit: 0 },
        });
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing error:", error);
    return NextResponse.json(
      { error: "Erreur lors du traitement du webhook." },
      { status: 500 },
    );
  }
}
