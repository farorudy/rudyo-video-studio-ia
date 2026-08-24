const { loadEnvConfig } = require("@next/env");
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

loadEnvConfig(process.cwd());

const envFile = process.env.SEED_ENV_FILE;
if (envFile) {
  const fullPath = path.resolve(process.cwd(), envFile);
  const content = fs.readFileSync(fullPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index);
    const value = trimmed
      .slice(index + 1)
      .replace(/^"(.*)"$/, "$1")
      .replace(/^'(.*)'$/, "$1");
    process.env[key] = value;
  }
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    process.env.PRISMA_DATABASE_URL || process.env.POSTGRES_URL || "";
}

const prisma = new PrismaClient();

const email = "rudy.faro@gmail.com";
const name = "FARO MIRVAL";
const initialCredits = Number.parseInt(process.env.INITIAL_CREDITS ?? "20", 10);
const credits = Number.isFinite(initialCredits) && initialCredits >= 0 ? initialCredits : 20;

async function main() {
  await prisma.creditPack.upsert({
    where: { slug: "tiktok-clip-complet" },
    update: { name: "Pack Clip TikTok complet", priceCents: 3500, credits: 3500, active: true },
    create: { slug: "tiktok-clip-complet", name: "Pack Clip TikTok complet", priceCents: 3500, credits: 3500, active: true },
  });
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      credits,
      creditsTotal: credits,
      creditsRemaining: credits,
      monthlyLimit: credits,
      billingStatus: "ACTIVE",
    },
    create: {
      email,
      name,
      credits,
      plan: "FREE",
      billingStatus: "ACTIVE",
      creditsTotal: credits,
      creditsUsed: 0,
      creditsRemaining: credits,
      monthlyLimit: credits,
      monthlyUsed: 0,
    },
  });

  if (prisma.creditAccount) {
    await prisma.creditAccount.upsert({
      where: { userId: user.id },
      update: { balance: credits },
      create: {
        userId: user.id,
        balance: credits,
      },
    });
  }

  console.log(
    `Utilisateur de test pret: ${user.email} (${user.name}) avec ${credits} credits.`,
  );
}

main()
  .catch((error) => {
    console.error("Seed Rudy impossible:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
