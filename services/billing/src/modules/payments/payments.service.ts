import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { publish } from '../../lib/publisher';
import { NotFoundError, UnprocessableError, ConflictError } from '../../lib/errors';
import { parsePagination, buildPaginatedResult } from '../../lib/pagination';
import { paymentsTotal } from '../../lib/metrics';
import type { CreatePaymentBodyType, ListPaymentsQueryType } from './payments.schema';

interface RequestContext {
  companyId: string;
}

export class PaymentsService {
  async list(query: ListPaymentsQueryType, ctx: RequestContext) {
    const { page, limit, skip } = parsePagination(query);

    const where: Prisma.PaymentWhereInput = { companyId: ctx.companyId };
    if (query.invoiceId) where.invoiceId = query.invoiceId;

    const [data, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take:    limit,
        include: { invoice: { select: { id: true, clientName: true, total: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.payment.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async create(body: CreatePaymentBodyType, ctx: RequestContext) {
    // ── Idempotência por chave ────────────────────────────────────────────────
    if (body.idempotencyKey) {
      const existing = await prisma.payment.findUnique({
        where: { idempotencyKey: body.idempotencyKey },
      });
      if (existing) {
        // Retorna o pagamento já existente sem erro — garante exactly-once
        return existing;
      }
    }

    // ── ACID: pagamento + atualização da fatura + movimento financeiro ────────
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where:   { id: body.invoiceId, companyId: ctx.companyId },
        include: { payments: true },
      });
      if (!invoice) throw new NotFoundError('Fatura');

      if (invoice.status === 'CANCELLED') {
        throw new UnprocessableError('Não é possível registrar pagamento em fatura cancelada');
      }
      if (invoice.status === 'PAID') {
        throw new UnprocessableError('Fatura já está totalmente paga');
      }

      // Calcula total já pago (apenas pagamentos CONFIRMED)
      const paidSoFar = invoice.payments
        .filter((p) => p.status === 'CONFIRMED')
        .reduce((acc, p) => acc + p.amount, 0);

      const remaining = invoice.total - paidSoFar;

      if (body.amount > remaining + 0.01) {
        throw new UnprocessableError(
          `Valor (R$ ${body.amount.toFixed(2)}) excede o saldo devedor da fatura (R$ ${remaining.toFixed(2)})`,
        );
      }

      // Cria o pagamento já como CONFIRMED (pagamento imediato)
      const payment = await tx.payment.create({
        data: {
          companyId:      ctx.companyId,
          invoiceId:      body.invoiceId,
          method:         body.method,
          amount:         body.amount,
          status:         'CONFIRMED',
          paidAt:         new Date(),
          idempotencyKey: body.idempotencyKey,
          note:           body.note,
        },
      });

      // Cria movimento financeiro de INCOME na mesma transação
      await tx.financialMovement.create({
        data: {
          companyId: ctx.companyId,
          invoiceId: body.invoiceId,
          type:      'INCOME',
          amount:    body.amount,
          note:      `Pagamento ${body.method} — fatura ${body.invoiceId}`,
        },
      });

      // Recalcula status da fatura
      const totalConfirmed = paidSoFar + body.amount;
      const newStatus =
        totalConfirmed >= invoice.total - 0.01 ? 'PAID' : 'PARTIALLY_PAID';

      await tx.invoice.update({
        where: { id: body.invoiceId },
        data:  { status: newStatus },
      });

      paymentsTotal.inc({ event: 'confirmed', method: body.method });

      // Publica evento fora da transação (após commit)
      setImmediate(() => {
        publish('payment.confirmed', {
          paymentId:  payment.id,
          invoiceId:  payment.invoiceId,
          companyId:  payment.companyId,
          amount:     payment.amount,
          method:     payment.method,
          paidAt:     payment.paidAt,
          newInvoiceStatus: newStatus,
        }).catch((err) => console.error('[payments.service] Falha ao publicar payment.confirmed:', err));
      });

      return payment;
    });
  }

  async cancel(id: string, ctx: RequestContext) {
    const payment = await prisma.payment.findFirst({
      where: { id, companyId: ctx.companyId },
    });
    if (!payment) throw new NotFoundError('Pagamento');

    if (payment.status === 'CANCELLED') {
      throw new UnprocessableError('Pagamento já está cancelado');
    }

    // Pagamentos nunca são deletados — apenas cancelados
    return prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data:  { status: 'CANCELLED', cancelledAt: new Date() },
      });

      // Se o pagamento estava CONFIRMED, cria movimento de REFUND e reverte fatura
      if (payment.status === 'CONFIRMED') {
        await tx.financialMovement.create({
          data: {
            companyId: ctx.companyId,
            invoiceId: payment.invoiceId,
            type:      'REFUND',
            amount:    payment.amount,
            note:      `Cancelamento do pagamento ${id}`,
          },
        });

        // Recalcula status da fatura após cancelamento
        const remainingPayments = await tx.payment.findMany({
          where: { invoiceId: payment.invoiceId, status: 'CONFIRMED' },
        });
        const totalPaid  = remainingPayments.reduce((acc, p) => acc + p.amount, 0);
        const invoice    = await tx.invoice.findUnique({ where: { id: payment.invoiceId } });
        const newStatus =
          totalPaid <= 0
            ? 'ISSUED'
            : totalPaid >= (invoice?.total ?? 0) - 0.01
            ? 'PAID'
            : 'PARTIALLY_PAID';

        await tx.invoice.update({
          where: { id: payment.invoiceId },
          data:  { status: newStatus },
        });
      }

      paymentsTotal.inc({ event: 'cancelled', method: payment.method });

      setImmediate(() => {
        publish('payment.cancelled', {
          paymentId:  updated.id,
          invoiceId:  updated.invoiceId,
          companyId:  updated.companyId,
          cancelledAt: updated.cancelledAt,
        }).catch((err) => console.error('[payments.service] Falha ao publicar payment.cancelled:', err));
      });

      return updated;
    });
  }
}

export const paymentsService = new PaymentsService();
