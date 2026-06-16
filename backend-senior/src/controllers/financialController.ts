import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { FinancialService } from '../modules/financial/financial.service';

const paymentMethodSchema = z.enum([
  'CASH',
  'PIX',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'BANK_TRANSFER',
  'BOLETO',
  'CHECK',
]);

const createInvoiceSchema = z.object({
  clientId: z.string().min(1),
  serviceOrderId: z.string().min(1).optional(),
  items: z.array(z.object({
    description: z.string().min(1),
    amount: z.number().nonnegative(),
  })).min(1),
  discount: z.number().nonnegative().optional(),
  tax: z.number().nonnegative().optional(),
  dueDate: z.string().datetime(),
  notes: z.string().optional(),
});

const createPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  method: paymentMethodSchema,
  amount: z.number().positive(),
  discount: z.number().nonnegative().optional(),
  interest: z.number().nonnegative().optional(),
  fine: z.number().nonnegative().optional(),
  dueDate: z.string().datetime(),
  installments: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

const cancelPaymentSchema = z.object({
  reason: z.string().min(3),
});

const summaryQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const listInvoicesQuerySchema = z.object({
  status: z.enum(['DRAFT', 'ISSUED', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED']).optional(),
  clientId: z.string().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

type RequestUser = { id: string; companyId: string };

const service = new FinancialService();

export class FinancialController {
  async listInvoices(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as RequestUser;
    const query = listInvoicesQuerySchema.parse(request.query);
    const result = await service.listInvoices({
      companyId: user.companyId,
      status: query.status,
      clientId: query.clientId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page,
      limit: query.limit,
    });
    return reply.send(result);
  }

  async createInvoice(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as RequestUser;
    const body = createInvoiceSchema.parse(request.body);
    const result = await service.createInvoice(body, user);
    return reply.status(201).send(result);
  }

  async createPayment(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as RequestUser;
    const body = createPaymentSchema.parse(request.body);
    const result = await service.createPayment(body, user);
    return reply.status(201).send(result);
  }

  async confirmPayment(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = request.user as RequestUser;
    const result = await service.confirmPayment(request.params.id, user);
    return reply.send(result);
  }

  async cancelPayment(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = request.user as RequestUser;
    const body = cancelPaymentSchema.parse(request.body);
    const result = await service.cancelPayment({ paymentId: request.params.id, reason: body.reason }, user);
    return reply.send(result);
  }

  async reversePayment(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = request.user as RequestUser;
    const body = cancelPaymentSchema.parse(request.body);
    const result = await service.reversePayment(request.params.id, body.reason, user);
    return reply.send(result);
  }

  async summary(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as RequestUser;
    const query = summaryQuerySchema.parse(request.query);
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(new Date(to).setMonth(to.getMonth() - 1));
    const result = await service.financialSummary(user.companyId, from, to);
    return reply.send(result);
  }
}
