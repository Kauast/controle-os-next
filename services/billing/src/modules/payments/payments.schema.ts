import { z } from 'zod';

export const CreatePaymentBody = z.object({
  invoiceId:      z.string().min(1, 'invoiceId obrigatório'),
  method:         z.enum(['CASH','CREDIT_CARD','DEBIT_CARD','PIX','BANK_TRANSFER','BOLETO']),
  amount:         z.number().positive('Valor deve ser positivo'),
  idempotencyKey: z.string().optional(),
  note:           z.string().optional(),
});

export const ListPaymentsQuery = z.object({
  invoiceId: z.string().optional(),
  page:      z.coerce.number().int().positive().optional(),
  limit:     z.coerce.number().int().positive().max(100).optional(),
});

export const PaymentIdParam = z.object({
  id: z.string().min(1),
});

export type CreatePaymentBodyType = z.infer<typeof CreatePaymentBody>;
export type ListPaymentsQueryType = z.infer<typeof ListPaymentsQuery>;
export type PaymentIdParamType    = z.infer<typeof PaymentIdParam>;
