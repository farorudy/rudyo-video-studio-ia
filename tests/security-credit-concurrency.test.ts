import assert from "node:assert/strict";
import test from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test("les réservations concurrentes ne dépassent jamais le solde", { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const { PrismaClient } = await import("@prisma/client");
  const { reserveCredits, refundCreditUsage } = await import("../lib/credit-utils");
  const db = new PrismaClient();
  const marker = crypto.randomUUID();
  const user = await db.user.create({ data: { email: `security-${marker}@example.test`, credits: 10, creditsTotal: 10, creditsRemaining: 10, monthlyLimit: 10, emailVerifiedAt: new Date() } });
  try {
    const attempts = await Promise.allSettled(Array.from({ length: 5 }, (_, index) => reserveCredits({
      userId: user.id,
      action: "storyboard",
      amount: 4,
      idempotencyKey: `concurrency:${marker}:${index}`,
    })));
    const successes = attempts.filter((attempt) => attempt.status === "fulfilled");
    assert.equal(successes.length, 2);
    const balance = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { creditsRemaining: true } });
    assert.equal(balance.creditsRemaining, 2);

    const reservation = (successes[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof reserveCredits>>>).value;
    await refundCreditUsage(reservation.id);
    await refundCreditUsage(reservation.id);
    const refunded = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { creditsRemaining: true } });
    assert.equal(refunded.creditsRemaining, 6);
  } finally {
    await db.creditUsage.deleteMany({ where: { userId: user.id } });
    await db.creditTransaction.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});
