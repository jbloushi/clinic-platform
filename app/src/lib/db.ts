import { PrismaClient } from '@prisma/client';

const g = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  g.prisma ??
  new PrismaClient({
    log: process.env.APP_ENV === 'production' ? ['error'] : ['warn', 'error'],
  });

if (process.env.APP_ENV !== 'production') g.prisma = prisma;
