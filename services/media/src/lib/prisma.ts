import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

function buildPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

// Singleton — evita múltiplas conexões em hot-reload
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? buildPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
