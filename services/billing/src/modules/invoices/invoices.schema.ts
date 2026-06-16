import { z } from 'zod';

export const CreateInvoiceBody = z.object({
  serviceOrderId: z.string().optional(),
  clientId:       z.string().min(1, 'clientId obrigatório'),
  clientName:     z.string().min(1, 'clientName obrigatório'),
  items: z.array(
    z.object({
      description: z.string().min(1),
      qty:         z.number().positive(),
      unitPrice:   z.number().nonnegative(),
    }),
  ).min(1, 'Ao menos um item é obrigatório'),
  discount: z.number().nonnegative().optional(),
  dueDate:  z.string().datetime({ offset: true }).optional(),
  note:     z.string().optional(),
});

export const ListInvoicesQuery = z.object({
  status:         z.enum(['DRAFT','ISSUED','PARTIALLY_PAID','PAID','CANCELLED','OVERDUE']).optional(),
  clientId:       z.string().optional(),
  serviceOrderId: z.string().optional(),
  page:           z.coerce.number().int().positive().optional(),
  limit:          z.coerce.number().int().positive().max(100).optional(),
});

export const InvoiceIdParam = z.object({
  id: z.string().min(1),
});

export type CreateInvoiceBodyType  = z.infer<typeof CreateInvoiceBody>;
export type ListInvoicesQueryType  = z.infer<typeof ListInvoicesQuery>;
export type InvoiceIdParamType     = z.infer<typeof InvoiceIdParam>;
