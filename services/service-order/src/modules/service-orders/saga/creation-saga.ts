import { PrismaClient, ServiceOrder, ServiceOrderItem } from '@prisma/client';
import { customerClient, workforceClient, inventoryClient, chipClient } from '../../../lib/http-client';
import { publish } from '../../../lib/publisher';
import { AppError } from '../../../lib/errors';
import { sagaTotal, sagaStepDuration } from '../../../lib/metrics';
import { compensateCreation, SagaState } from './compensation';
import { CreateServiceOrderInput } from '../service-orders.schema';

interface RequestUser {
  id: string;
  role: string;
  companyId: string;
  name: string;
}

interface CustomerResponse {
  id: string;
  name: string;
  isBlocked: boolean;
  blockedReason?: string;
}

interface TechnicianCapacityResponse {
  hasCapacity: boolean;
  currentLoad: number;
  maxLoad: number;
}

interface ReservationResponse {
  reservationId: string;
  productId: string;
  quantity: number;
  status: string;
}

type ServiceOrderWithItems = ServiceOrder & { items: ServiceOrderItem[] };

/**
 * Saga Orchestrator de Criação de OS
 *
 * Passos sequenciais com compensação em caso de falha:
 *   1. Criar OS local com status PENDING_RESERVATION
 *   2. Validar cliente (Customer Svc)
 *   3. Validar capacidade do técnico (Workforce Svc) — se fornecido
 *   4. Reservar produtos no estoque (Inventory Svc) — para items tipo PRODUCT
 *   5. Vincular chip (Chip Svc) — se chipId fornecido
 *   6. Atualizar OS para OPEN, persistir reservationIds, publicar os.created
 */
export async function runCreationSaga(
  data: CreateServiceOrderInput,
  user: RequestUser,
  prisma: PrismaClient,
): Promise<ServiceOrderWithItems> {
  const sagaState: SagaState = {
    step: 0,
    reservationIds: [],
    chipAssigned: false,
    compensated: false,
  };

  // ── Passo 1: Criar OS local com PENDING_RESERVATION ─────────────────────
  const stepTimer1 = sagaStepDuration.startTimer({ step: '1_create_local' });
  sagaState.step = 1;

  // Gerar número sequencial por empresa
  const result = await (prisma as unknown as { $queryRaw: Function }).$queryRaw<Array<{ nextNum: number }>>`
    SELECT COALESCE(MAX(CAST(number AS INTEGER)), 0) + 1 AS "nextNum"
    FROM "ServiceOrder"
    WHERE "companyId" = ${user.companyId}
  `;
  const orderNumber = String(result[0]?.nextNum ?? 1);

  const items = data.items.map((item) => ({
    type: item.type,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.quantity * item.unitPrice,
    productId: item.productId ?? null,
  }));

  const os = await prisma.serviceOrder.create({
    data: {
      number: orderNumber,
      companyId: user.companyId,
      status: 'PENDING_RESERVATION',
      priority: data.priority ?? 'MEDIUM',
      clientId: data.clientId,
      clientName: data.clientName,
      technicianId: data.technicianId ?? null,
      technicianName: data.technicianName ?? null,
      teamId: data.teamId ?? null,
      description: data.description,
      internalNote: data.internalNote ?? null,
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
      sagaState: sagaState as unknown as Parameters<typeof prisma.serviceOrder.create>[0]['data']['sagaState'],
      items: items.length > 0 ? { create: items } : undefined,
      schedules: data.schedules && data.schedules.length > 0
        ? {
            create: data.schedules.map((s) => ({
              scheduledStart: new Date(s.scheduledStart),
              scheduledEnd:   s.scheduledEnd ? new Date(s.scheduledEnd) : null,
              technicianId:   s.technicianId ?? null,
              note:           s.note ?? null,
            })),
          }
        : undefined,
      history: {
        create: {
          toStatus: 'PENDING_RESERVATION',
          note: 'OS criada — aguardando reserva de estoque',
          userId: user.id,
          userName: user.name,
        },
      },
    },
    include: { items: true },
  });

  stepTimer1();

  // ── Passo 2: Validar cliente ─────────────────────────────────────────────
  const stepTimer2 = sagaStepDuration.startTimer({ step: '2_validate_customer' });
  sagaState.step = 2;

  let customer: CustomerResponse;
  try {
    customer = await customerClient.get<CustomerResponse>(`/clients/${data.clientId}`);
  } catch (err) {
    stepTimer2();
    await compensateCreation({ serviceOrderId: os.id, companyId: user.companyId, chipId: data.chipId, sagaState }, prisma);
    sagaTotal.inc({ result: 'failure' });
    throw new AppError(`Falha ao validar cliente: ${(err as Error).message}`, 422, 'SAGA_CUSTOMER_VALIDATION');
  }

  if (customer.isBlocked) {
    stepTimer2();
    await compensateCreation({ serviceOrderId: os.id, companyId: user.companyId, chipId: data.chipId, sagaState }, prisma);
    sagaTotal.inc({ result: 'failure' });
    throw new AppError(`Cliente bloqueado: ${customer.blockedReason ?? 'motivo não informado'}`, 422, 'CLIENT_BLOCKED');
  }

  stepTimer2();

  // ── Passo 3: Validar capacidade do técnico ───────────────────────────────
  if (data.technicianId) {
    const stepTimer3 = sagaStepDuration.startTimer({ step: '3_validate_technician' });
    sagaState.step = 3;

    let capacity: TechnicianCapacityResponse;
    try {
      capacity = await workforceClient.get<TechnicianCapacityResponse>(
        `/technicians/${data.technicianId}/capacity`,
      );
    } catch (err) {
      stepTimer3();
      await compensateCreation({ serviceOrderId: os.id, companyId: user.companyId, chipId: data.chipId, sagaState }, prisma);
      sagaTotal.inc({ result: 'failure' });
      throw new AppError(`Falha ao validar técnico: ${(err as Error).message}`, 422, 'SAGA_TECHNICIAN_VALIDATION');
    }

    if (!capacity.hasCapacity) {
      stepTimer3();
      await compensateCreation({ serviceOrderId: os.id, companyId: user.companyId, chipId: data.chipId, sagaState }, prisma);
      sagaTotal.inc({ result: 'failure' });
      throw new AppError(
        `Técnico sem capacidade (${capacity.currentLoad}/${capacity.maxLoad} OS ativas)`,
        422,
        'TECHNICIAN_NO_CAPACITY',
      );
    }

    stepTimer3();
  }

  // ── Passo 4: Reservar produtos no Inventory ──────────────────────────────
  const productItems = os.items.filter((i) => i.type === 'PRODUCT' && i.productId);
  sagaState.step = 4;

  for (const item of productItems) {
    const stepTimer4 = sagaStepDuration.startTimer({ step: '4_reserve_stock' });

    let reservation: ReservationResponse;
    try {
      reservation = await inventoryClient.post<ReservationResponse>('/stock/reservations', {
        productId:      item.productId,
        serviceOrderId: os.id,
        quantity:       item.quantity,
      });
      sagaState.reservationIds.push(reservation.reservationId);
    } catch (err) {
      stepTimer4();
      await compensateCreation({ serviceOrderId: os.id, companyId: user.companyId, chipId: data.chipId, sagaState }, prisma);
      sagaTotal.inc({ result: 'failure' });
      throw new AppError(
        `Falha ao reservar estoque para produto ${item.productId}: ${(err as Error).message}`,
        422,
        'SAGA_STOCK_RESERVATION',
      );
    }

    stepTimer4();
  }

  // ── Passo 5: Vincular chip ───────────────────────────────────────────────
  if (data.chipId) {
    const stepTimer5 = sagaStepDuration.startTimer({ step: '5_assign_chip' });
    sagaState.step = 5;

    try {
      await chipClient.post(`/chips/${data.chipId}/assign`, {
        clientId:   data.clientId,
        clientName: data.clientName,
      });
      sagaState.chipAssigned = true;
    } catch (err) {
      stepTimer5();
      await compensateCreation({ serviceOrderId: os.id, companyId: user.companyId, chipId: data.chipId, sagaState }, prisma);
      sagaTotal.inc({ result: 'failure' });
      throw new AppError(
        `Falha ao vincular chip ${data.chipId}: ${(err as Error).message}`,
        422,
        'SAGA_CHIP_ASSIGN',
      );
    }

    stepTimer5();
  }

  // ── Passo 6: Atualizar OS para OPEN, persistir reservationIds ────────────
  const stepTimer6 = sagaStepDuration.startTimer({ step: '6_finalize' });
  sagaState.step = 6;

  // Mapeia reservationId para o item correto (pela posição dos productItems)
  const itemUpdates = productItems.map((item, idx) => ({
    id: item.id,
    reservationId: sagaState.reservationIds[idx] ?? null,
  }));

  for (const upd of itemUpdates) {
    await prisma.serviceOrderItem.update({
      where: { id: upd.id },
      data:  { reservationId: upd.reservationId },
    });
  }

  const finalOs = await prisma.serviceOrder.update({
    where: { id: os.id },
    data: {
      status:    'OPEN',
      sagaState: { ...sagaState, compensated: false } as unknown as Parameters<typeof prisma.serviceOrder.update>[0]['data']['sagaState'],
      history: {
        create: {
          fromStatus: 'PENDING_RESERVATION',
          toStatus:   'OPEN',
          note:       'Saga concluída — OS aberta',
          userId:     user.id,
          userName:   user.name,
        },
      },
      events: {
        create: {
          type:    'os.created',
          payload: { status: 'OPEN', reservationIds: sagaState.reservationIds } as unknown as Parameters<typeof prisma.serviceOrder.update>[0]['data']['events'],
        },
      },
    },
    include: { items: true },
  });

  await publish({
    routingKey: 'os.created',
    payload: {
      serviceOrderId: finalOs.id,
      number:         finalOs.number,
      companyId:      finalOs.companyId,
      clientId:       finalOs.clientId,
      clientName:     finalOs.clientName,
      technicianId:   finalOs.technicianId,
      priority:       finalOs.priority,
      createdAt:      finalOs.createdAt.toISOString(),
    },
  });

  stepTimer6();
  sagaTotal.inc({ result: 'success' });

  return finalOs as ServiceOrderWithItems;
}
