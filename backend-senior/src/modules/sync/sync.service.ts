import { z } from 'zod';
import { ServiceOrderService } from '../service-order/service-order.service';
import { updateStatusSchema, updateExecutionSchema } from '../service-order/service-order.rules';
import { AppError } from '../../lib/errors';

interface RequestUser {
  id: string;
  role: string;
  companyId: string;
}

export const syncActionSchema = z.object({
  clientActionId: z.string().min(1),
  type: z.enum(['UPDATE_STATUS', 'UPDATE_EXECUTION']),
  serviceOrderId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  expectedVersion: z.number().int().positive().optional(),
});

export const syncBatchSchema = z.object({
  actions: z.array(syncActionSchema).min(1).max(50),
});

export type SyncAction = z.infer<typeof syncActionSchema>;

export interface SyncResult {
  clientActionId: string;
  status: 'ok' | 'conflict' | 'error';
  data?: unknown;
  error?: string;
  code?: string;
}

const osService = new ServiceOrderService();

export class SyncService {
  /**
   * Processa um lote de ações offline de forma tolerante a falhas: cada item é
   * isolado, e um conflito/erro num item não derruba os demais. A idempotência
   * por item é garantida pelo plugin de Idempotency-Key na borda HTTP.
   */
  async processBatch(actions: SyncAction[], user: RequestUser): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    for (const action of actions) {
      try {
        const merged = { ...action.payload, expectedVersion: action.expectedVersion };
        let data: unknown;
        if (action.type === 'UPDATE_STATUS') {
          data = await osService.updateStatus(action.serviceOrderId, updateStatusSchema.parse(merged), user);
        } else {
          data = await osService.updateExecution(action.serviceOrderId, updateExecutionSchema.parse(merged), user);
        }
        results.push({ clientActionId: action.clientActionId, status: 'ok', data });
      } catch (err) {
        const isConflict = err instanceof AppError && err.statusCode === 409;
        results.push({
          clientActionId: action.clientActionId,
          status: isConflict ? 'conflict' : 'error',
          error: err instanceof Error ? err.message : 'Erro desconhecido',
          code: err instanceof AppError ? err.code : undefined,
        });
      }
    }
    return results;
  }
}
