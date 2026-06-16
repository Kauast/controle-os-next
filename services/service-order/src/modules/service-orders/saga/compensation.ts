import { PrismaClient } from '@prisma/client';
import { inventoryClient, chipClient } from '../../../lib/http-client';
import { publish } from '../../../lib/publisher';

export interface SagaState {
  step: number;
  reservationIds: string[];
  chipAssigned: boolean;
  compensated: boolean;
}

interface CompensationContext {
  serviceOrderId: string;
  companyId: string;
  chipId?: string;
  sagaState: SagaState;
}

/**
 * Executa todas as compensações necessárias em ordem inversa à saga.
 * É idempotente: verifica sagaState.compensated antes de agir.
 */
export async function compensateCreation(
  ctx: CompensationContext,
  prismaClient: PrismaClient | { serviceOrder: { update: Function } },
): Promise<void> {
  const { serviceOrderId, chipId, sagaState } = ctx;

  if (sagaState.compensated) {
    console.warn('[saga-compensation] Já compensado, ignorando:', serviceOrderId);
    return;
  }

  const errors: string[] = [];

  // Passo 5 reverso: liberar chip se foi vinculado
  if (sagaState.chipAssigned && chipId) {
    try {
      await chipClient.delete(`/chips/${chipId}/assign`);
      console.info('[saga-compensation] Chip desvinculado:', chipId);
    } catch (err) {
      const msg = `Falha ao desvincular chip ${chipId}: ${(err as Error).message}`;
      errors.push(msg);
      console.error('[saga-compensation]', msg);
    }
  }

  // Passo 4 reverso: liberar todas as reservas de estoque criadas
  for (const reservationId of sagaState.reservationIds) {
    try {
      await inventoryClient.post(`/stock/reservations/${reservationId}/release`, {});
      console.info('[saga-compensation] Reserva liberada:', reservationId);
    } catch (err) {
      const msg = `Falha ao liberar reserva ${reservationId}: ${(err as Error).message}`;
      errors.push(msg);
      console.error('[saga-compensation]', msg);
    }
  }

  // Passo 1 reverso: soft-delete da OS e marca como CANCELLED
  try {
    const prisma = prismaClient as PrismaClient;
    await prisma.serviceOrder.update({
      where: { id: serviceOrderId },
      data: {
        status: 'CANCELLED',
        cancelReason: 'SAGA_COMPENSATION',
        cancelledAt: new Date(),
        deletedAt: new Date(),
        sagaState: {
          ...sagaState,
          compensated: true,
        } as unknown as Parameters<typeof prisma.serviceOrder.update>[0]['data']['sagaState'],
      },
    });

    // Publica evento de cancelamento para outros serviços reagirem
    await publish({
      routingKey: 'os.cancelled',
      payload: {
        serviceOrderId,
        reason: 'SAGA_COMPENSATION',
        cancelledAt: new Date().toISOString(),
      },
    });

    console.info('[saga-compensation] OS cancelada por compensação:', serviceOrderId);
  } catch (err) {
    const msg = `Falha ao cancelar OS ${serviceOrderId}: ${(err as Error).message}`;
    errors.push(msg);
    console.error('[saga-compensation]', msg);
  }

  if (errors.length > 0) {
    // Logar erros de compensação parcial — requer intervenção manual
    console.error('[saga-compensation] COMPENSAÇÃO PARCIAL — erros:', errors);
  }
}
