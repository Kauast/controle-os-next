import { Status } from '@prisma/client';
import { z } from 'zod';

export const createOSSchema = z.object({
  clientId: z.string().cuid(),
  dueDate: z.string().datetime(),
  technicianId: z.string().cuid().optional(),
  items: z.array(
    z.object({
      description: z.string().min(1),
      quantity: z.number().int().positive(),
      unitPrice: z.number().positive(),
      itemType: z.enum(['PRODUCT', 'SERVICE']),
      productId: z.string().cuid().optional(),
    })
  ).min(1),
});

export type CreateOSInput = z.infer<typeof createOSSchema>;

const allowedTransitions: Record<Status, Status[]> = {
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_PARTS', 'COMPLETED', 'CANCELLED'],
  WAITING_PARTS: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: Status, to: Status): boolean {
  return allowedTransitions[from]?.includes(to) ?? false;
}
