import { z } from 'zod';

export const ListMovementsQuery = z.object({
  type:      z.enum(['INCOME','EXPENSE','REFUND']).optional(),
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate:   z.string().datetime({ offset: true }).optional(),
  page:      z.coerce.number().int().positive().optional(),
  limit:     z.coerce.number().int().positive().max(100).optional(),
});

export const SummaryQuery = z.object({
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate:   z.string().datetime({ offset: true }).optional(),
});

export type ListMovementsQueryType = z.infer<typeof ListMovementsQuery>;
export type SummaryQueryType       = z.infer<typeof SummaryQuery>;
