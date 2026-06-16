import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

function buildPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export type PrismaClientInstance = ReturnType<typeof buildPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientInstance;
};

export const prisma = globalForPrisma.prisma ?? buildPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// Tipo do TransactionClient derivado diretamente do client
export type TxClient = Parameters<Parameters<typeof prisma['$transaction']>[0]>[0];
