import { OrderStatus, Priority, PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { publish } from '../../lib/publisher';
import { workforceClient } from '../../lib/http-client';
import { AppError, NotFoundError, ForbiddenError } from '../../lib/errors';
import { parsePagination, buildPaginatedResult } from '../../lib/pagination';
import {
  canTransition,
  CreateServiceOrderInput,
  UpdateStatusInput,
  AssignInput,
  UpdateExecutionInput,
  ListQueryInput,
} from './service-orders.schema';
import { runCreationSaga } from './saga/creation-saga';

export interface RequestUser {
  id: string;
  role: string;
  companyId: string;
  name: string;
}

export class ServiceOrderService {
  // ─── CREATE — dispara a Saga de Criação ────────────────────────────────────

  async create(data: CreateServiceOrderInput, user: RequestUser) {
    // A saga cria a OS em PENDING_RESERVATION e só retorna após todos os passos
    return runCreationSaga(data, user, prisma as unknown as PrismaClient);
  }

  // ─── LIST ─────────────────────────────────────────────────────────────────

  async list(params: ListQueryInput & { companyId: string }, user: RequestUser) {
    const { page, limit, skip } = parsePagination(params);

    const where: Record<string, unknown> = { companyId: params.companyId, deletedAt: null };

    if (params.status)       where.status       = params.status as OrderStatus;
    if (params.priority)     where.priority     = params.priority as Priority;
    if (params.technicianId) where.technicianId = params.technicianId;
    if (params.clientId)     where.clientId     = params.clientId;
    if (params.search) {
      where.OR = [
        { description:  { contains: params.search, mode: 'insensitive' } },
        { clientName:   { contains: params.search, mode: 'insensitive' } },
      ];
    }

    // Técnico só vê suas próprias OS
    if (user.role === 'TECHNICIAN') {
      where.technicianId = user.id;
    }

    const rawPrisma = prisma as unknown as PrismaClient;

    const [data2, total] = await Promise.all([
      rawPrisma.serviceOrder.findMany({
        where: where as Parameters<typeof rawPrisma.serviceOrder.findMany>[0]['where'],
        skip,
        take: limit,
        include: {
          items:      true,
          schedules:  true,
          executions: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      }),
      rawPrisma.serviceOrder.count({
        where: where as Parameters<typeof rawPrisma.serviceOrder.count>[0]['where'],
      }),
    ]);

    return buildPaginatedResult(data2, total, page, limit);
  }

  // ─── FIND BY ID ───────────────────────────────────────────────────────────

  async findById(id: string, user: RequestUser) {
    const rawPrisma = prisma as unknown as PrismaClient;

    const where: Record<string, unknown> = { id, companyId: user.companyId, deletedAt: null };
    if (user.role === 'TECHNICIAN') where.technicianId = user.id;

    const os = await rawPrisma.serviceOrder.findFirst({
      where: where as Parameters<typeof rawPrisma.serviceOrder.findFirst>[0]['where'],
      include: {
        items:      true,
        schedules:  true,
        executions: true,
        history:    { orderBy: { createdAt: 'asc' } },
        events:     { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });

    if (!os) throw new NotFoundError('OS');
    return os;
  }

  // ─── ASSIGN — OPEN → ASSIGNED ─────────────────────────────────────────────

  async assign(id: string, input: AssignInput, user: RequestUser) {
    const rawPrisma = prisma as unknown as PrismaClient;

    const os = await rawPrisma.serviceOrder.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null } as Parameters<typeof rawPrisma.serviceOrder.findFirst>[0]['where'],
    });
    if (!os) throw new NotFoundError('OS');

    if (os.status !== 'OPEN') {
      throw new AppError(`Não é possível atribuir OS com status ${os.status}. Status esperado: OPEN`, 422);
    }

    // Valida capacidade do técnico via Workforce Svc
    try {
      const capacity = await workforceClient.get<{ hasCapacity: boolean; currentLoad: number; maxLoad: number }>(
        `/technicians/${input.technicianId}/capacity`,
      );
      if (!capacity.hasCapacity) {
        throw new AppError(
          `Técnico sem capacidade (${capacity.currentLoad}/${capacity.maxLoad} OS ativas)`,
          422,
          'TECHNICIAN_NO_CAPACITY',
        );
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      // Se o Workforce Svc estiver fora, loga mas não bloqueia (degraded mode)
      console.warn('[assign] Não foi possível validar capacidade do técnico:', (err as Error).message);
    }

    const updated = await rawPrisma.serviceOrder.update({
      where: { id },
      data: {
        status:        'ASSIGNED',
        technicianId:  input.technicianId,
        technicianName: input.technicianName,
        history: {
          create: {
            fromStatus: os.status as OrderStatus,
            toStatus:   'ASSIGNED',
            note:       `Atribuído a ${input.technicianName}`,
            userId:     user.id,
            userName:   user.name,
          },
        },
        events: {
          create: {
            type:    'os.assigned',
            payload: { technicianId: input.technicianId, technicianName: input.technicianName } as unknown as Parameters<typeof rawPrisma.serviceOrder.update>[0]['data']['events'],
          },
        },
      },
      include: { items: true },
    });

    await publish({
      routingKey: 'os.assigned',
      payload: {
        serviceOrderId: os.id,
        number:         os.number,
        companyId:      os.companyId,
        technicianId:   input.technicianId,
        technicianName: input.technicianName,
        assignedAt:     new Date().toISOString(),
        assignedBy:     user.id,
      },
    });

    return updated;
  }

  // ─── UPDATE STATUS — máquina de estados ───────────────────────────────────

  async updateStatus(id: string, input: UpdateStatusInput, user: RequestUser) {
    const rawPrisma = prisma as unknown as PrismaClient;

    const where: Record<string, unknown> = { id, companyId: user.companyId, deletedAt: null };
    if (user.role === 'TECHNICIAN') where.technicianId = user.id;

    const os = await rawPrisma.serviceOrder.findFirst({
      where: where as Parameters<typeof rawPrisma.serviceOrder.findFirst>[0]['where'],
    });
    if (!os) throw new NotFoundError('OS');

    if (user.role === 'TECHNICIAN' && os.technicianId !== user.id) {
      throw new ForbiddenError('Técnico não autorizado para esta OS');
    }

    if (!canTransition(os.status as Parameters<typeof canTransition>[0], input.status)) {
      throw new AppError(`Transição inválida: ${os.status} → ${input.status}`, 422, 'INVALID_TRANSITION');
    }

    const now = new Date();
    const updateData: Record<string, unknown> = { status: input.status };

    if (input.status === 'COMPLETED') updateData.completedAt = now;
    if (input.status === 'CANCELLED') {
      updateData.cancelledAt = now;
      updateData.cancelReason = input.cancelReason;
    }

    const updated = await rawPrisma.serviceOrder.update({
      where: { id },
      data: {
        ...(updateData as Parameters<typeof rawPrisma.serviceOrder.update>[0]['data']),
        history: {
          create: {
            fromStatus: os.status as OrderStatus,
            toStatus:   input.status as OrderStatus,
            note:       input.note ?? input.cancelReason,
            userId:     user.id,
            userName:   user.name,
          },
        },
        events: {
          create: {
            type: `os.${input.status.toLowerCase()}`,
            payload: { from: os.status, to: input.status, note: input.note } as unknown as Parameters<typeof rawPrisma.serviceOrder.update>[0]['data']['events'],
          },
        },
      },
      include: { items: true },
    });

    const routingKey = this._routingKeyForStatus(input.status);
    if (routingKey) {
      await publish({
        routingKey,
        payload: {
          serviceOrderId: os.id,
          number:         os.number,
          companyId:      os.companyId,
          status:         input.status,
          changedAt:      now.toISOString(),
          changedBy:      user.id,
          cancelReason:   input.cancelReason,
        },
      });
    }

    return updated;
  }

  // ─── UPDATE EXECUTION — check-in / check-out / GPS / assinatura ───────────

  async updateExecution(id: string, data: UpdateExecutionInput, user: RequestUser) {
    const rawPrisma = prisma as unknown as PrismaClient;

    const where: Record<string, unknown> = { id, companyId: user.companyId, deletedAt: null };
    if (user.role === 'TECHNICIAN') where.technicianId = user.id;

    const os = await rawPrisma.serviceOrder.findFirst({
      where: where as Parameters<typeof rawPrisma.serviceOrder.findFirst>[0]['where'],
    });
    if (!os) throw new NotFoundError('OS');

    if (['COMPLETED', 'CANCELLED'].includes(os.status)) {
      throw new AppError('OS finalizada — não é possível registrar execução', 422);
    }

    if (user.role === 'TECHNICIAN' && os.technicianId !== user.id) {
      throw new ForbiddenError('Técnico não autorizado para esta OS');
    }

    const execData: Record<string, unknown> = {
      serviceOrderId: id,
      technicianId:   data.technicianId,
    };
    if (data.checkinAt    !== undefined) execData.checkinAt   = new Date(data.checkinAt);
    if (data.checkoutAt   !== undefined) execData.checkoutAt  = new Date(data.checkoutAt);
    if (data.checkinLat   !== undefined) execData.checkinLat  = data.checkinLat;
    if (data.checkinLng   !== undefined) execData.checkinLng  = data.checkinLng;
    if (data.checkoutLat  !== undefined) execData.checkoutLat = data.checkoutLat;
    if (data.checkoutLng  !== undefined) execData.checkoutLng = data.checkoutLng;
    if (data.signatureUrl !== undefined) execData.signatureUrl = data.signatureUrl;
    if (data.note         !== undefined) execData.note         = data.note;

    await rawPrisma.serviceOrderExecution.create({
      data: execData as Parameters<typeof rawPrisma.serviceOrderExecution.create>[0]['data'],
    });

    await rawPrisma.serviceOrderEvent.create({
      data: {
        serviceOrderId: id,
        type:    'os.execution_recorded',
        payload: execData as unknown as Parameters<typeof rawPrisma.serviceOrderEvent.create>[0]['data']['payload'],
      },
    });

    await publish({
      routingKey: 'os.execution_recorded',
      payload: {
        serviceOrderId: os.id,
        technicianId:   data.technicianId,
        checkinAt:      data.checkinAt,
        checkoutAt:     data.checkoutAt,
        recordedAt:     new Date().toISOString(),
      },
    });

    return rawPrisma.serviceOrder.findFirst({
      where:   { id } as Parameters<typeof rawPrisma.serviceOrder.findFirst>[0]['where'],
      include: { executions: true, items: true },
    });
  }

  // ─── SOFT DELETE ──────────────────────────────────────────────────────────

  async delete(id: string, user: RequestUser) {
    const rawPrisma = prisma as unknown as PrismaClient;

    const os = await rawPrisma.serviceOrder.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null } as Parameters<typeof rawPrisma.serviceOrder.findFirst>[0]['where'],
    });
    if (!os) throw new NotFoundError('OS');

    if (!['OPEN', 'PENDING_RESERVATION'].includes(os.status)) {
      throw new AppError(`Não é possível excluir OS com status ${os.status}. Só é permitido em OPEN ou PENDING_RESERVATION.`, 422);
    }

    await rawPrisma.serviceOrder.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status:    'CANCELLED',
        cancelReason: 'EXCLUIDO_PELO_USUARIO',
        cancelledAt:  new Date(),
      },
    });

    return { success: true, message: 'OS removida com sucesso' };
  }

  // ─── HISTORY ──────────────────────────────────────────────────────────────

  async getHistory(id: string, user: RequestUser) {
    const rawPrisma = prisma as unknown as PrismaClient;

    const os = await rawPrisma.serviceOrder.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null } as Parameters<typeof rawPrisma.serviceOrder.findFirst>[0]['where'],
      select: { id: true },
    });
    if (!os) throw new NotFoundError('OS');

    return rawPrisma.serviceOrderHistory.findMany({
      where:   { serviceOrderId: id },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ─── EVENTS ───────────────────────────────────────────────────────────────

  async getEvents(id: string, user: RequestUser) {
    const rawPrisma = prisma as unknown as PrismaClient;

    const os = await rawPrisma.serviceOrder.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null } as Parameters<typeof rawPrisma.serviceOrder.findFirst>[0]['where'],
      select: { id: true },
    });
    if (!os) throw new NotFoundError('OS');

    return rawPrisma.serviceOrderEvent.findMany({
      where:   { serviceOrderId: id },
      orderBy: { createdAt: 'desc' },
      take:    100,
    });
  }

  // ─── PRIVATE ──────────────────────────────────────────────────────────────

  private _routingKeyForStatus(status: string): string | null {
    const map: Record<string, string> = {
      IN_PROGRESS:  'os.started',
      COMPLETED:    'os.completed',
      CANCELLED:    'os.cancelled',
      ASSIGNED:     'os.assigned',
      WAITING_PARTS: 'os.waiting_parts',
    };
    return map[status] ?? null;
  }
}
