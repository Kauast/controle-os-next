import { z } from 'zod';

const ROLES = ['ADMIN', 'SUPERVISOR', 'STOCK', 'TECHNICIAN', 'ATTENDANT', 'FINANCIAL'] as const;

export const createUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email('E-mail invalido'),
  password: z.string().min(8, 'Senha deve ter no minimo 8 caracteres'),
  role: z.enum(ROLES).default('ATTENDANT'),
  // companyId e injetado do JWT pelo controller — nao aceitar do body
});

export const updateUserSchema = z
  .object({
    name: z.string().min(2).optional(),
    role: z.enum(ROLES).optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'Informe ao menos um campo para atualizar',
  });

export const listUsersQuerySchema = z.object({
  role: z.enum(ROLES).optional(),
  active: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
