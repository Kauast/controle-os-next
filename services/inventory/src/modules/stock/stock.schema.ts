import { z } from 'zod';

export const createMovementSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'RESERVATION_RELEASE']),
  quantity: z.number().positive(),
  note: z.string().max(500).optional(),
});

export const createReservationSchema = z.object({
  productId: z.string().min(1),
  serviceOrderId: z.string().min(1),
  quantity: z.number().positive(),
});

export const listMovementsQuerySchema = z.object({
  productId: z.string().optional(),
  serviceOrderId: z.string().optional(),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'RESERVATION_RELEASE']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreateMovementInput = z.infer<typeof createMovementSchema>;
export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type ListMovementsQuery = z.infer<typeof listMovementsQuerySchema>;
