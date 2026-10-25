import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { mileQuestPrisma?: PrismaClient };

export const prisma = globalForPrisma.mileQuestPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.mileQuestPrisma = prisma;
}
