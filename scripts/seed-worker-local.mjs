import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL?.includes("127.0.0.1:55432/rudyo_worker_local")) {
  throw new Error("Refus du seed : DATABASE_URL ne cible pas la base locale isolée attendue.");
}

const prisma = new PrismaClient();
const users = [
  { id: "local-insufficient", email: "novice-insufficient@rudyo.test", name: "Novice insuffisant", credits: 100 },
  { id: "local-exact-3500", email: "novice-exact@rudyo.test", name: "Novice exact", credits: 3_500 },
];

try {
  await prisma.$executeRawUnsafe("ALTER DATABASE rudyo_worker_local SET timezone TO 'UTC'");
  if (process.env.LOCAL_TEST_RESET === "true") {
    const ids = users.map((user) => user.id);
    await prisma.videoProject.deleteMany({ where: { userId: { in: ids } } });
    await prisma.creditUsage.deleteMany({ where: { userId: { in: ids } } });
    await prisma.creditTransaction.deleteMany({ where: { userId: { in: ids } } });
    await prisma.transaction.deleteMany({ where: { userId: { in: ids } } });
    await prisma.authSession.deleteMany({ where: { userId: { in: ids } } });
    await prisma.apiIdempotency.deleteMany({ where: { ownerKey: { in: ids } } });
    await prisma.authThrottle.deleteMany({});
    await prisma.stripeWebhookEvent.deleteMany({ where: { stripeEventId: { startsWith: "evt_mock_" } } });
  }
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      create: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerifiedAt: new Date(),
        credits: user.credits,
        creditsTotal: user.credits,
        creditsRemaining: user.credits,
        monthlyLimit: user.credits,
      },
      update: {
        name: user.name,
        emailVerifiedAt: new Date(),
        credits: user.credits,
        creditsTotal: user.credits,
        creditsUsed: 0,
        creditsRemaining: user.credits,
        monthlyLimit: user.credits,
        monthlyUsed: 0,
      },
    });
  }
  console.log("Deux comptes Rudyo locaux isolés ont été préparés (100 et 3500 crédits).");
} finally {
  await prisma.$disconnect();
}
