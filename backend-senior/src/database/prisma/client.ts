import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { RequestContext } from '../../shared/context/requestContext';

const SOFT_DELETE_MODELS = new Set([
  'Company',
  'Role',
  'User',
  'Client',
  'Chip',
  'Team',
  'Technician',
  'ServiceOrder',
  'ServiceOrderItem',
  'ServiceOrderSchedule',
  'ServiceOrderExecution',
  'Attachment',
  'ProductCategory',
  'Product',
  'StockReservation',
  'MaterialRequest',
  'Invoice',
  'Payment',
  'FinancialMovement',
]);

const VERSIONED_MODELS = new Set([
  'Company',
  'Role',
  'User',
  'Client',
  'Chip',
  'Team',
  'Technician',
  'ServiceOrder',
  'ServiceOrderItem',
  'ServiceOrderSchedule',
  'ServiceOrderExecution',
  'Attachment',
  'ProductCategory',
  'Product',
  'StockReservation',
  'MaterialRequest',
  'Invoice',
  'Payment',
  'FinancialMovement',
]);

function createClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  client.$use(async (params, next) => {
    const context = RequestContext.get();
    const model = params.model;

    if (model && SOFT_DELETE_MODELS.has(model)) {
      if (params.action === 'delete') {
        params.action = 'update';
        params.args['data'] = {
          deletedAt: new Date(),
          deletedBy: context.userId ?? 'system',
          ...(VERSIONED_MODELS.has(model) ? { version: { increment: 1 } } : {}),
        };
      }

      if (params.action === 'deleteMany') {
        params.action = 'updateMany';
        params.args['data'] = {
          deletedAt: new Date(),
          deletedBy: context.userId ?? 'system',
          ...(VERSIONED_MODELS.has(model) ? { version: { increment: 1 } } : {}),
        };
      }
    }

    return next(params);
  });

  return client;
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export type PrismaTransaction = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

