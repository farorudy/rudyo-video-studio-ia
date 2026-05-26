import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  return new PrismaClient();
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
