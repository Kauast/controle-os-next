import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
  channel: z.enum(['EMAIL', 'SMS', 'PUSH']).optional(),
  status:  z.enum(['PENDING', 'SENT', 'FAILED']).optional(),
  page:    z.coerce.number().int().positive().optional().default(1),
  limit:   z.coerce.number().int().positive().max(100).optional().default(20),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
