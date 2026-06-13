import { OrderStatus } from '@prisma/client';
import { z } from 'zod';

export const createOSSchema = z.object({
  clientId: z.string().min(1),
  dueDate: z.string().datetime(),
  technicianId: z.string().min(1).optional(),
  description: z.string().optional(),
  team: z.string().optional(),
  priority: z.enum(['NORMAL', 'WARNING', 'HIGH']).optional(),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  items: z.array(
    z.object({
      description: z.string().min(1),
      quantity: z.number().int().positive(),
      unitPrice: z.number().positive(),
      itemType: z.enum(['PRODUCT', 'SERVICE']),
      productId: z.string().min(1).optional(),
    })
  ).default([]),
});

export type CreateOSInput = z.infer<typeof createOSSchema>;

export const updateExecutionSchema = z.object({
  checkinAt: z.string().datetime().optional(),
  checkoutAt: z.string().datetime().optional(),
  checkinLocation: z.string().optional(),
  checkinLat: z.number().optional(),
  checkinLng: z.number().optional(),
  checkoutLat: z.number().optional(),
  checkoutLng: z.number().optional(),
  photoUrls: z.array(z.string()).optional(),
  clientSignature: z.string().optional(),
  chipId: z.string().optional(),
  workDoneNotes: z.string().optional(),
});

export type UpdateExecutionInput = z.infer<typeof updateExecutionSchema>;

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_PARTS', 'COMPLETED', 'CANCELLED'],
  WAITING_PARTS: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return allowedTransitions[from]?.includes(to) ?? false;
}
