import { z } from 'zod';

export const createProductSchema = z.object({
  companyId: z.string().min(1),
  categoryId: z.string().optional(),
  name: z.string().min(1).max(200),
  unit: z.string().min(1).max(20),
  minStock: z.number().min(0).default(0),
  price: z.number().min(0).optional(),
  isActive: z.boolean().default(true),
});

export const updateProductSchema = z.object({
  categoryId: z.string().optional().nullable(),
  name: z.string().min(1).max(200).optional(),
  unit: z.string().min(1).max(20).optional(),
  minStock: z.number().min(0).optional(),
  price: z.number().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const listProductsQuerySchema = z.object({
  categoryId: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  belowMinStock: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
