import { z } from 'zod';

export const createMaterialRequestSchema = z.object({
  serviceOrderId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number().positive(),
  note: z.string().max(500).optional(),
});

export const reviewMaterialRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});

export const listMaterialRequestsQuerySchema = z.object({
  serviceOrderId: z.string().optional(),
  productId: z.string().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreateMaterialRequestInput = z.infer<typeof createMaterialRequestSchema>;
export type ReviewMaterialRequestInput = z.infer<typeof reviewMaterialRequestSchema>;
export type ListMaterialRequestsQuery = z.infer<typeof listMaterialRequestsQuerySchema>;
