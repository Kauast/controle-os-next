import { z } from 'zod';

export const OrderStatusEnum = z.enum([
  'PENDING_RESERVATION',
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'WAITING_PARTS',
]);

export const PriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const ItemTypeEnum  = z.enum(['SERVICE', 'PRODUCT', 'EXPENSE']);

// ── Máquina de estados ──────────────────────────────────────────────────────
export type OrderStatusType = z.infer<typeof OrderStatusEnum>;

const TRANSITIONS: Record<OrderStatusType, OrderStatusType[]> = {
  PENDING_RESERVATION: ['OPEN', 'CANCELLED'],
  OPEN:                ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED', 'WAITING_PARTS'],
  ASSIGNED:            ['IN_PROGRESS', 'OPEN', 'CANCELLED'],
  IN_PROGRESS:         ['COMPLETED', 'CANCELLED', 'WAITING_PARTS'],
  WAITING_PARTS:       ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED:           [],
  CANCELLED:           [],
};

export function canTransition(from: OrderStatusType, to: OrderStatusType): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Schemas de request ──────────────────────────────────────────────────────

export const createServiceOrderSchema = z.object({
  clientId:      z.string().min(1),
  clientName:    z.string().min(1),
  description:   z.string().min(1),
  priority:      PriorityEnum.optional().default('MEDIUM'),
  technicianId:  z.string().min(1).optional(),
  technicianName: z.string().optional(),
  teamId:        z.string().min(1).optional(),
  scheduledDate: z.string().datetime().optional(),
  internalNote:  z.string().optional(),
  items: z.array(
    z.object({
      type:        ItemTypeEnum,
      description: z.string().min(1),
      quantity:    z.number().positive(),
      unitPrice:   z.number().nonnegative(),
      productId:   z.string().min(1).optional(),
    }),
  ).default([]),
  schedules: z.array(
    z.object({
      scheduledStart: z.string().datetime(),
      scheduledEnd:   z.string().datetime().optional(),
      technicianId:   z.string().optional(),
      note:           z.string().optional(),
    }),
  ).optional(),
  chipId: z.string().optional(),
});

export const updateStatusSchema = z.object({
  status:       OrderStatusEnum,
  note:         z.string().optional(),
  cancelReason: z.string().min(3).optional(),
}).refine(
  (d) => d.status !== 'CANCELLED' || !!d.cancelReason,
  { message: 'cancelReason é obrigatório ao cancelar', path: ['cancelReason'] },
);

export const assignSchema = z.object({
  technicianId:   z.string().min(1),
  technicianName: z.string().min(1),
});

export const updateExecutionSchema = z.object({
  technicianId: z.string().min(1),
  checkinAt:    z.string().datetime().optional(),
  checkoutAt:   z.string().datetime().optional(),
  checkinLat:   z.number().optional(),
  checkinLng:   z.number().optional(),
  checkoutLat:  z.number().optional(),
  checkoutLng:  z.number().optional(),
  signatureUrl: z.string().url().optional(),
  note:         z.string().optional(),
});

export const listQuerySchema = z.object({
  status:       OrderStatusEnum.optional(),
  priority:     PriorityEnum.optional(),
  technicianId: z.string().optional(),
  clientId:     z.string().optional(),
  search:       z.string().optional(),
  page:         z.coerce.number().int().positive().optional(),
  limit:        z.coerce.number().int().positive().max(100).optional(),
});

// ── Types derivados ─────────────────────────────────────────────────────────
export type CreateServiceOrderInput = z.infer<typeof createServiceOrderSchema>;
export type UpdateStatusInput       = z.infer<typeof updateStatusSchema>;
export type AssignInput             = z.infer<typeof assignSchema>;
export type UpdateExecutionInput    = z.infer<typeof updateExecutionSchema>;
export type ListQueryInput          = z.infer<typeof listQuerySchema>;
