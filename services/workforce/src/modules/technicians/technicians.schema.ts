import { z } from 'zod';

export const TechnicianStatusEnum = z.enum(['AVAILABLE', 'BUSY', 'OFF']);

export const createTechnicianSchema = z.object({
  userId: z.string().min(1, 'userId obrigatório'),
  companyId: z.string().min(1, 'companyId obrigatório'),
  name: z.string().min(2, 'Nome precisa ter ao menos 2 caracteres'),
  email: z.string().email().optional(),
  maxConcurrentOS: z.number().int().min(1).max(50).default(3),
  specialties: z.array(z.string()).default([]),
});

export const updateTechnicianSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional().nullable(),
  maxConcurrentOS: z.number().int().min(1).max(50).optional(),
  specialties: z.array(z.string()).optional(),
});

export const updateTechnicianStatusSchema = z.object({
  status: TechnicianStatusEnum,
});

export const listTechniciansQuerySchema = z.object({
  status: TechnicianStatusEnum.optional(),
  isActive: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateTechnicianInput = z.infer<typeof createTechnicianSchema>;
export type UpdateTechnicianInput = z.infer<typeof updateTechnicianSchema>;
export type UpdateTechnicianStatusInput = z.infer<typeof updateTechnicianStatusSchema>;
export type ListTechniciansQuery = z.infer<typeof listTechniciansQuerySchema>;
