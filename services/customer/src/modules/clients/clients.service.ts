import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { publish } from '../../lib/publisher';
import { NotFoundError, ConflictError, AppError } from '../../lib/errors';
import { parsePagination, buildPaginatedResult } from '../../lib/pagination';
import type {
  CreateClientInput,
  UpdateClientInput,
  BlockClientInput,
  ListClientsQuery,
} from './clients.schema';

interface RequestUser {
  id: string;
  companyId: string;
  role: string;
}

function makeEvent(
  eventType: string,
  companyId: string,
  payload: Record<string, unknown>,
) {
  return {
    eventType,
    companyId,
    payload,
    schemaVersion: '1' as const,
    timestamp: new Date().toISOString(),
  };
}

export class ClientsService {
  async list(query: ListClientsQuery, companyId: string) {
    const { page, limit, skip } = parsePagination({ page: query.page, limit: query.limit });

    const where: Prisma.ClientWhereInput = {
      companyId,
      deletedAt: null,
    };

    if (query.isBlocked !== undefined) {
      where.isBlocked = query.isBlocked;
    }

    if (query.name) {
      where.name = { contains: query.name, mode: 'insensitive' };
    }

    if (query.document) {
      where.document = { contains: query.document };
    }

    const [data, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          companyId: true,
          name: true,
          email: true,
          phone: true,
          document: true,
          type: true,
          isBlocked: true,
          blockedAt: true,
          blockedReason: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.client.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findById(id: string, companyId: string) {
    const client = await prisma.client.findFirst({
      where: { id, companyId, deletedAt: null },
    });

    if (!client) throw new NotFoundError('Cliente');
    return client;
  }

  async create(data: CreateClientInput, user: RequestUser) {
    if (data.document) {
      const existing = await prisma.client.findFirst({
        where: { companyId: user.companyId, document: data.document, deletedAt: null },
      });
      if (existing) throw new ConflictError('Documento ja cadastrado para esta empresa');
    }

    const client = await prisma.client.create({
      data: {
        ...data,
        companyId: user.companyId,
        address: data.address as Prisma.InputJsonValue | undefined,
      },
    });

    await publish(
      makeEvent('client.created', user.companyId, {
        clientId: client.id,
        name: client.name,
        document: client.document,
        type: client.type,
      }),
    );

    return client;
  }

  async update(id: string, data: UpdateClientInput, user: RequestUser) {
    const client = await prisma.client.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
    });
    if (!client) throw new NotFoundError('Cliente');

    if (data.document && data.document !== client.document) {
      const conflict = await prisma.client.findFirst({
        where: {
          companyId: user.companyId,
          document: data.document,
          deletedAt: null,
          id: { not: id },
        },
      });
      if (conflict) throw new ConflictError('Documento ja em uso por outro cliente');
    }

    const updated = await prisma.client.update({
      where: { id },
      data: {
        ...data,
        address: data.address as Prisma.InputJsonValue | undefined,
      },
    });

    await publish(
      makeEvent('client.updated', user.companyId, {
        clientId: id,
        changes: Object.keys(data),
      }),
    );

    return updated;
  }

  async softDelete(id: string, user: RequestUser) {
    const client = await prisma.client.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
    });
    if (!client) throw new NotFoundError('Cliente');

    await prisma.client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await publish(
      makeEvent('client.deleted', user.companyId, {
        clientId: id,
        name: client.name,
      }),
    );

    return { success: true };
  }

  async block(id: string, data: BlockClientInput, user: RequestUser) {
    const client = await prisma.client.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
    });
    if (!client) throw new NotFoundError('Cliente');

    if (client.isBlocked) throw new AppError('Cliente ja esta bloqueado', 409, 'ALREADY_BLOCKED');

    const updated = await prisma.client.update({
      where: { id },
      data: {
        isBlocked: true,
        blockedAt: new Date(),
        blockedReason: data.reason,
      },
    });

    await publish(
      makeEvent('client.blocked', user.companyId, {
        clientId: id,
        reason: data.reason,
        blockedAt: updated.blockedAt?.toISOString(),
      }),
    );

    return updated;
  }

  async unblock(id: string, user: RequestUser) {
    const client = await prisma.client.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
    });
    if (!client) throw new NotFoundError('Cliente');

    if (!client.isBlocked) throw new AppError('Cliente nao esta bloqueado', 409, 'NOT_BLOCKED');

    const updated = await prisma.client.update({
      where: { id },
      data: {
        isBlocked: false,
        blockedAt: null,
        blockedReason: null,
      },
    });

    await publish(
      makeEvent('client.unblocked', user.companyId, {
        clientId: id,
      }),
    );

    return updated;
  }
}
