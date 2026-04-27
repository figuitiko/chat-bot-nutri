import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import { shouldReusePrismaClient } from "@/lib/prisma-client-cache";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const adapter = new PrismaPg({
      connectionString: env.DATABASE_URL,
    });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function getPrismaClient() {
  if (shouldReusePrismaClient(globalForPrisma.prisma)) {
    return globalForPrisma.prisma as PrismaClient;
  }

  return createPrismaClient();
}

export const db = getPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
