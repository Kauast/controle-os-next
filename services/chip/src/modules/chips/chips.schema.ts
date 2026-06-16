import { z } from 'zod';

export const chipStatusValues = ['AVAILABLE', 'ASSIGNED', 'INSTALLED', 'INACTIVE'] as const;

// ── Chip CRUD ──────────────────────────────────────────────────────────────

export const createChipSchema = z.object({
  iccid: z.string().min(3).max(30),
  number: z.string().max(20).optional(),
  operator: z.string().max(50).optional(),
});

export const updateChipSchema = z.object({
  iccid: z.string().min(3).max(30).optional(),
  number: z.string().max(20).optional(),
  operator: z.string().max(50).optional(),
});

// ── Lifecycle ──────────────────────────────────────────────────────────────

export const assignChipSchema = z.object({
  clientId: z.string().min(1),
  clientName: z.string().min(1).max(255),
});

export const installChipSchema = z.object({
  serviceOrderId: z.string().min(1),
});

// ── Query ──────────────────────────────────────────────────────────────────

export const listChipsQuerySchema = z.object({
  status: z.enum(chipStatusValues).optional(),
  clientId: z.string().optional(),
  operator: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ── Types ──────────────────────────────────────────────────────────────────

export type CreateChipInput = z.infer<typeof createChipSchema>;
export type UpdateChipInput = z.infer<typeof updateChipSchema>;
export type AssignChipInput = z.infer<typeof assignChipSchema>;
export type InstallChipInput = z.infer<typeof installChipSchema>;
export type ListChipsQuery = z.infer<typeof listChipsQuerySchema>;
