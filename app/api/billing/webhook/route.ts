import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import {
  getStripeClient,
  getCreditPack,
  getFirstPurchaseBonusTokens,
} from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserByEmail } from "@/lib/auth";
import { quoteClip } from "@/lib/tiktok-offer";
import { type AutomaticClipPlanCode } from "@/lib/clip-pricing";
import { validateClipTopUpFulfillment } from "@/lib/clip-topup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLAN_MONTHLY_CREDITS = {
  FREE: 0,
  STARTER: 150,
  CREATOR: 500,
  STUDIO: 1500,
} as const;

async function claimStripeEvent(event: Stripe.Event) {
  try {
    await prisma.stripeWebhookEvent.create({
      data: { stripeEventId: event.id, type: event.type },
    });
    return true;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }

    const existing = await prisma.stripeWebhookEvent.findUnique({
      where: { stripeEventId: event.id },
    });
    if (!existing || existing.status === "PROCESSED" || existing.status === "PROCESSING") {
      return false;
    }

    const retried = await prisma.stripeWebhookEvent.updateMany({
      where: { stripeEventId: event.id, status: "FAILED" },
      data: { status: "PROCESSING", errorMessage: null },
    });
    return retried.count === 1;
  }
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const value = (invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
    parent?: { subscription_details?: { subscription?: string | Stripe.Subscription | null } } | null;
  }).parent?.subscription_details?.subscription ??
    (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription;
  return typeof value === "string" ? value : value?.id ?? null;
}

async function grantSubscriptionInvoice(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!customerId || !subscriptionId || invoice.status !== "paid") return;

  const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
  if (!user) return;
  const credits = PLAN_MONTHLY_CREDITS[user.plan];
  if (credits <= 0) return;
  const period = invoice.lines.data[0]?.period;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.subscriptionCreditGrant.findUnique({
      where: { invoiceId: invoice.id },
      select: { id: true },
    });
    if (existing) return;

    await tx.subscriptionCreditGrant.create({
      data: {
        invoiceId: invoice.id,
        stripeSubscriptionId: subscriptionId,
        userId: user.id,
        credits,
        periodStart: period?.start ? new Date(period.start * 1000) : null,
        periodEnd: period?.end ? new Date(period.end * 1000) : null,
      },
    });
    await tx.creditTransaction.create({
      data: {
        userId: user.id,
        type: "PURCHASE",
        action: "OTHER",
        creditsAmount: credits,
        description: "Crédits mensuels d’abonnement",
        idempotencyKey: `stripe-invoice:${invoice.id}`,
        status: "CONFIRMED",
        confirmedAt: new Date(),
        metadata: { invoiceId: invoice.id, subscriptionId },
      },
    });
    await tx.user.update({
      where: { id: user.id },
      data: {
        credits: { increment: credits },
        creditsTotal: { increment: credits },
        creditsRemaining: { increment: credits },
        monthlyLimit: credits,
        monthlyUsed: 0,
        billingStatus: "ACTIVE",
      },
    });
  });
}

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

async function hasProcessedStripeSession(sessionId: string) {
  const purchase = await prisma.transaction.findUnique({
    where: { stripeSessionId: sessionId },
    select: { id: true },
  });
  if (purchase) {
    return true;
  }

  const existing = await prisma.creditTransaction.findFirst({
    where: {
      metadata: {
        path: ["stripeSessionId"],
        equals: sessionId,
      },
    },
    select: { id: true },
  });

  return Boolean(existing);
}

async function resolveCheckoutUser(session: Stripe.Checkout.Session) {
  const metadataUserId = session.metadata?.userId;
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;
  const email = session.customer_details?.email?.trim().toLowerCase();

  if (metadataUserId) {
    const user = await prisma.user.findUnique({ where: { id: metadataUserId } });
    if (user) {
      if (customerId && user.stripeCustomerId !== customerId) {
        return prisma.user.update({
          where: { id: user.id },
          data: { stripeCustomerId: customerId },
        });
      }
      return user;
    }
  }

  if (customerId) {
    const user = await prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
    });
    if (user) {
      return user;
    }
  }

  if (!email) {
    return null;
  }

  const user = await getOrCreateUserByEmail(email);
  if (customerId && user.stripeCustomerId !== customerId) {
    return prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  return user;
}

export async function POST(req: NextRequest) {
  let verifiedEventId: string | null = null;
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
    verifiedEventId = event.id;
    if (!(await claimStripeEvent(event))) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};
        const productId = metadata.productId as string | undefined;
        const mode = metadata.mode as string | undefined;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;

        if (session.mode === "payment" && session.payment_status !== "paid") {
          console.warn("Checkout session completed before payment was paid", {
            sessionId: session.id,
            paymentStatus: session.payment_status,
          });
          break;
        }

        const user = await resolveCheckoutUser(session);
        if (!user) {
          console.warn("Checkout session completed without resolvable user", {
            sessionId: session.id,
          });
          break;
        }

        if (mode === "clip_topup" && metadata.projectId) {
          const project = await prisma.videoProject.findFirst({
            where: { id: metadata.projectId, userId: user.id, status: "DRAFT", clipPlan: { not: null } },
            select: { id: true, billedDurationSeconds: true, durationSeconds: true, clipPlan: true },
          });
          if (!project) throw new Error("Projet de recharge introuvable.");
          if (!project.clipPlan || project.clipPlan === "CUSTOM") throw new Error("Formule de recharge invalide.");
          const quote = quoteClip(project.billedDurationSeconds || project.durationSeconds || 0, 0, project.clipPlan as AutomaticClipPlanCode);
          if (!quote.fitsSelectedPlan) throw new Error("Formule de recharge invalide.");
          const purchasedCredits = Number.parseInt(metadata.tokens || "", 10);
          const balanceAtCheckout = Number.parseInt(metadata.balanceAtCheckout || "", 10);
          if (!Number.isInteger(purchasedCredits)) throw new Error("Montant de recharge incohérent.");
          validateClipTopUpFulfillment({ requiredCredits: quote.totalCredits, balanceAtCheckout, purchasedCredits, amountTotal: session.amount_total });
          if (!(await hasProcessedStripeSession(session.id))) {
            await prisma.$transaction(async (tx) => {
              const existing = await tx.transaction.findUnique({ where: { stripeSessionId: session.id }, select: { id: true } });
              if (existing) return;
              await tx.transaction.create({
                data: {
                  userId: user.id,
                  stripeSessionId: session.id,
                  amount: purchasedCredits,
                  tokens: purchasedCredits,
                  status: "CONFIRMED",
                  metadata: { productId, mode, projectId: project.id, plan: quote.plan, normalizedSeconds: quote.normalizedSeconds, requiredCredits: quote.totalCredits, stripeCustomerId: customerId },
                },
              });
              await tx.creditTransaction.create({
                data: {
                  userId: user.id,
                  type: "PURCHASE",
                  action: "CLIP_PACK",
                  creditsAmount: purchasedCredits,
                  description: `Recharge exacte · ${quote.planName}`,
                  idempotencyKey: `stripe-session:${session.id}`,
                  status: "CONFIRMED",
                  confirmedAt: new Date(),
                  metadata: { stripeSessionId: session.id, projectId: project.id, amount: session.amount_total, plan: quote.plan },
                },
              });
              await tx.user.update({
                where: { id: user.id },
                data: { credits: { increment: purchasedCredits }, creditsTotal: { increment: purchasedCredits }, creditsRemaining: { increment: purchasedCredits }, billingStatus: "ACTIVE" },
              });
              await tx.videoProject.update({ where: { id: project.id }, data: { paymentCompletedAt: new Date(), status: "DRAFT" } });
            });
          }
        }

        if (mode === "credit" && productId) {
          const creditPack = getCreditPack(productId);
          if (creditPack) {
            if (await hasProcessedStripeSession(session.id)) {
              break;
            }

            await prisma.$transaction(async (tx) => {
              const existing = await tx.transaction.findUnique({
                where: { stripeSessionId: session.id },
                select: { id: true },
              });
              if (existing) {
                return;
              }

              const previousPurchases = await tx.transaction.count({
                where: {
                  userId: user.id,
                  status: "CONFIRMED",
                },
              });
              const bonusTokens =
                previousPurchases === 0 ? getFirstPurchaseBonusTokens() : 0;
              const totalTokens = creditPack.credits + bonusTokens;

              await tx.transaction.create({
                data: {
                  userId: user.id,
                  stripeSessionId: session.id,
                  amount: session.amount_total ?? creditPack.amount,
                  tokens: totalTokens,
                  status: "CONFIRMED",
                  metadata: {
                    productId,
                    stripeCustomerId: customerId,
                    baseTokens: creditPack.credits,
                    bonusTokens,
                    currency: session.currency,
                    couponFutureReady: true,
                  },
                },
              });

              await tx.creditTransaction.create({
                data: {
                  userId: user.id,
                  type: "PURCHASE",
                  action: "OTHER",
                  creditsAmount: totalTokens,
                  description:
                    bonusTokens > 0
                      ? `Achat ${creditPack.name} + bonus premier achat`
                      : `Achat ${creditPack.name}`,
                  status: "CONFIRMED",
                  metadata: {
                    stripeSessionId: session.id,
                    productId,
                    amount: session.amount_total ?? creditPack.amount,
                    baseTokens: creditPack.credits,
                    bonusTokens,
                  },
                },
              });

              await tx.user.update({
                where: { id: user.id },
                data: {
                  credits: { increment: totalTokens },
                  creditsTotal: { increment: totalTokens },
                  creditsRemaining: { increment: totalTokens },
                  billingStatus: "ACTIVE",
                },
              });
            });
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
              ? 150
              : plan === "CREATOR"
                ? 500
                : plan === "STUDIO"
                  ? 1500
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
        await grantSubscriptionInvoice(invoice);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          await prisma.user.updateMany({
            where: { stripeCustomerId: customerId },
            data: { billingStatus: "PAST_DUE" },
          });
        }
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
                ? 150
                : plan === "CREATOR"
                  ? 500
                  : plan === "STUDIO"
                    ? 1500
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

    await prisma.stripeWebhookEvent.update({
      where: { stripeEventId: event.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    if (verifiedEventId) {
      await prisma.stripeWebhookEvent.updateMany({
        where: { stripeEventId: verifiedEventId, status: "PROCESSING" },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message.slice(0, 300) : "Erreur interne",
        },
      }).catch(() => undefined);
    }
    console.error("Stripe webhook processing error:", error);
    return NextResponse.json(
      { error: "Erreur lors du traitement du webhook." },
      { status: 500 },
    );
  }
}
