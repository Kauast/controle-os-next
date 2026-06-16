import { z } from 'zod';

export const createClientSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  document: z.string().min(11).max(18).optional(),
  type: z.enum(['INDIVIDUAL', 'COMPANY']).default('INDIVIDUAL'),
  address: z
    .object({
      street: z.string().optional(),
      number: z.string().optional(),
      complement: z.string().optional(),
      neighborhood: z.string().optional(),
      city: z.string().optional(),
      state: z.string().max(2).optional(),
      zipCode: z.string().optional(),
    })
    .optional(),
});

export const updateClientSchema = createClientSchema.partial();

export const blockClientSchema = z.object({
  reason: z.string().min(3).max(500),
});

export const listClientsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  name: z.string().optional(),
  document: z.string().optional(),
  isBlocked: z
    .string()
    .optional()
    .transform((v) => {
      if (v === 'true') return true;
      if (v === 'false') return false;
      return undefined;
    }),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type BlockClientInput = z.infer<typeof blockClientSchema>;
export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>;
