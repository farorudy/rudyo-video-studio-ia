import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  const primary = process.env.DATABASE_URL?.trim();
  const fallback = process.env.RUDYO_DB_PRISMA_DATABASE_URL?.trim() || process.env.POSTGRES_PRISMA_URL?.trim();
  const url = primary && /^postgres(?:ql)?:\/\//.test(primary) ? primary : fallback;
  return url ? new PrismaClient({ datasources: { db: { url } } }) : new PrismaClient();
}

export function getPrisma() {
  if (!global.prisma) {
    global.prisma = createPrismaClient();
  }

  return global.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, client);

    return typeof value === "function" ? value.bind(client) : value;
  },
});
