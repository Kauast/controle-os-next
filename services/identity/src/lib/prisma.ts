import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Models do Identity Service que usam soft-delete
const SOFT_DELETE_MODELS = new Set(['Company', 'User']);

function buildPrismaClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  return base.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }: { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            if (!args.where) args.where = {};
            if ((args.where as Record<string, unknown>).deletedAt === undefined) {
              (args.where as Record<string, unknown>).deletedAt = null;
            }
          }
          return query(args);
        },
        async findFirst({ model, args, query }: { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            if (!args.where) args.where = {};
            if ((args.where as Record<string, unknown>).deletedAt === undefined) {
              (args.where as Record<string, unknown>).deletedAt = null;
            }
          }
          return query(args);
        },
        async count({ model, args, query }: { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            if (!args.where) args.where = {};
            if ((args.where as Record<string, unknown>).deletedAt === undefined) {
              (args.where as Record<string, unknown>).deletedAt = null;
            }
          }
          return query(args);
        },
        async update({ args, query }: { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          return query(args);
        },
        async updateMany({ model, args, query }: { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            if (!args.where) args.where = {};
            if ((args.where as Record<string, unknown>).deletedAt === undefined) {
              (args.where as Record<string, unknown>).deletedAt = null;
            }
          }
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

export type TxClient = Parameters<Parameters<typeof prisma['$transaction']>[0]>[0];
