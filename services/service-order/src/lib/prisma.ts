import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

function buildPrismaClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  // Soft-delete: injeta deletedAt=null automaticamente nas queries de leitura
  return base.$extends({
    query: {
      serviceOrder: {
        async findMany({ args, query }: { args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          if (!args.where) args.where = {};
          const where = args.where as Record<string, unknown>;
          if (where.deletedAt === undefined) where.deletedAt = null;
          return query(args);
        },
        async findFirst({ args, query }: { args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          if (!args.where) args.where = {};
          const where = args.where as Record<string, unknown>;
          if (where.deletedAt === undefined) where.deletedAt = null;
          return query(args);
        },
        async count({ args, query }: { args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          if (!args.where) args.where = {};
          const where = args.where as Record<string, unknown>;
          if (where.deletedAt === undefined) where.deletedAt = null;
          return query(args);
        },
        async updateMany({ args, query }: { args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          if (!args.where) args.where = {};
          const where = args.where as Record<string, unknown>;
          if (where.deletedAt === undefined) where.deletedAt = null;
          return query(args);
        },
        async update({ args, query }: { args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          return query(args);
        },
      },
    },
  });
}

export type ExtendedPrismaClient = ReturnType<typeof buildPrismaClient>;

const globalForPrisma = globalThis as unknown as { prisma?: ExtendedPrismaClient };

export const prisma = globalForPrisma.prisma ?? buildPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
