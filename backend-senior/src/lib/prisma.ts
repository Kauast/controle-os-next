import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';

const SOFT_DELETE_MODELS = new Set([
  'Company', 'User', 'Client', 'Technician', 'Team',
  'Product', 'ServiceOrder', 'Chip', 'Invoice',
]);

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
        async findUnique({ model, args, query }: { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            (args.where as Record<string, unknown>).deletedAt = null;
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
        async update({ model, args, query }: { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            (args.where as Record<string, unknown>).deletedAt = null;
          }
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

// Exporta com tipo inferido para que extensões sejam visíveis nos módulos
export const prisma = buildPrismaClient();
export type ExtendedPrismaClient = ReturnType<typeof buildPrismaClient>;

// Expõe Prisma para uso de TransactionClient em serviços
export { Prisma };
