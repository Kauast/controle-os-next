import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z.string().min(2, 'Nome precisa ter ao menos 2 caracteres'),
});

export const updateTeamSchema = z.object({
  name: z.string().min(2).optional(),
  isActive: z.boolean().optional(),
});

export const addTeamMemberSchema = z.object({
  technicianId: z.string().min(1, 'technicianId obrigatório'),
  role: z.string().optional(),
});

export const listTeamsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isActive: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;
export type ListTeamsQuery = z.infer<typeof listTeamsQuerySchema>;
