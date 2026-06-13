import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';

const SOFT_DELETE_MODELS = new Set([
  'Company', 'User', 'Client', 'Technician', 'Team',
  'Product', 'ServiceOrder', 'Chip', 'Invoice',
]);

function buildPrismaClient() {
  const base = new PrismaClient({
    // 'query' omitido intencionalmente: adicionar query ao log array muda o TypeMap do Prisma
    // e rompe a compatibilidade de TransactionClient com $extends. Use prisma studio ou
    // habilite DATABASE_LOG=true + um listener $on('query') separado se precisar de query log.
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
        // findUnique NÃO recebe injeção de deletedAt: o Prisma rejeita em runtime qualquer
        // campo que não faça parte da chave única no where de findUnique. Call-sites que
        // precisam de soft-delete devem usar findFirst (que é interceptado acima).
        // O middleware authenticate() em auth.ts usa findFirst para cobrir esse caso.
        async count({ model, args, query }: { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            if (!args.where) args.where = {};
            if ((args.where as Record<string, unknown>).deletedAt === undefined) {
              (args.where as Record<string, unknown>).deletedAt = null;
            }
          }
          return query(args);
        },
        // update: NÃO injeta deletedAt no where — o Prisma exige que o where contenha
        // exatamente os campos da chave única (PK ou unique). Adicionar deletedAt causaria
        // erro de runtime. Call-sites devem garantir o escopo multi-tenant via companyId
        // diretamente no where, ou usar updateMany (que aceita filtros arbitrários).
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

// Singleton: evita múltiplas conexões em hot-reload (tsx watch / Next.js HMR)
const globalForPrisma = globalThis as unknown as {
  prisma?: ExtendedPrismaClient;
};

export const prisma = globalForPrisma.prisma ?? buildPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown — libera conexões ao encerrar o processo
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// Tipo correto do tx para client $extends — Prisma.TransactionClient NÃO é compatível
// com client estendido. Derive sempre a partir do próprio client estendido.
export type TxClient = Parameters<Parameters<typeof prisma['$transaction']>[0]>[0];

// Expõe Prisma para uso de TransactionClient em serviços
export { Prisma };
