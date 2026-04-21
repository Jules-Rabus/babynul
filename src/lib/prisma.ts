import { PrismaClient } from "@prisma/client";

// Singleton pour éviter d'ouvrir plusieurs pools en dev (HMR).
// En prod, chaque instance Fluid Compute a son propre PrismaClient.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
