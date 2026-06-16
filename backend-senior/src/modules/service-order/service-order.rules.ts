import { z } from 'zod';
import { OrderStatus } from '@prisma/client';

// Máquina de estados das OS — transições explícitas e auditáveis
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_PARTS', 'COMPLETED', 'CANCELLED'],
  WAITING_PARTS: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export const createServiceOrderSchema = z.object({
  clientId: z.string().min(1),
  dueDate: z.string().datetime(),
  technicianId: z.string().min(1).optional(),
  teamId: z.string().min(1).optional(),
  description: z.string().optional(),
  internalNotes: z.string().optional(),
  priority: z.enum(['NORMAL', 'WARNING', 'HIGH', 'CRITICAL']).optional(),
  chipIccid: z.string().optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative(),
        discount: z.number().nonnegative().optional().default(0),
        itemType: z.enum(['PRODUCT', 'SERVICE']),
        productId: z.string().min(1).optional(),
      }),
    )
    .default([]),
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  schedule: z
    .object({
      scheduledDate: z.string().datetime(),
      scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      estimatedHours: z.number().positive().optional(),
      notes: z.string().optional(),
    })
    .optional(),
}).refine(
  (data) => {
    if (data.scheduledStart && data.scheduledEnd) {
      return new Date(data.scheduledEnd) > new Date(data.scheduledStart);
    }
    return true;
  },
  { message: 'scheduledEnd deve ser posterior a scheduledStart', path: ['scheduledEnd'] },
);

export const updateStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  cancellationReason: z.string().min(3).optional(),
  note: z.string().optional(),
});

export const updateExecutionSchema = z.object({
  checkinAt: z.string().datetime().optional(),
  checkoutAt: z.string().datetime().optional(),
  checkinLocation: z.string().optional(),
  checkinLat: z.number().optional(),
  checkinLng: z.number().optional(),
  checkoutLat: z.number().optional(),
  checkoutLng: z.number().optional(),
  workDoneNotes: z.string().optional(),
  chipIccid: z.string()
    .refine((v) => /\d{5,}/.test(v.replace(/\D/g, '')), {
      message: 'ICCID deve conter ao menos 5 dígitos numéricos',
    })
    .optional(),
  photoUrls: z.array(z.string().url()).optional(),
  clientSignature: z.string().optional(),
  // Novo contrato: IDs de anexos privados (cuid), não URLs.
});

export const assignSchema = z.object({
  technicianId: z.string().min(1).nullable().optional(),
  teamId: z.string().min(1).nullable().optional(),
});

export type CreateServiceOrderInput = z.infer<typeof createServiceOrderSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type UpdateExecutionInput = z.infer<typeof updateExecutionSchema>;
export type AssignInput = z.infer<typeof assignSchema>;
