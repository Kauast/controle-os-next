import { Prisma, InvoiceStatus, PaymentStatus, PaymentMethod } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { audit } from '../audit/audit.service';
import { NotFoundError, AppError, ConcurrencyError, ValidationError } from '../../shared/errors';
import { parsePagination, buildPaginatedResult } from '../../shared/pagination';

interface RequestUser {
  id: string;
  companyId: string;
}

export interface CreateInvoiceParams {
  clientId: string;
  serviceOrderId?: string;
  items: Array<{ description: string; amount: number }>;
  discount?: number;
  tax?: number;
  dueDate: string;
  notes?: string;
}

export interface CreatePaymentParams {
  invoiceId: string;
  method: PaymentMethod;
  amount: number;
  discount?: number;
  interest?: number;
  fine?: number;
  dueDate: string;
  installments?: number;
  notes?: string;
}

export interface CancelPaymentParams {
  paymentId: string;
  reason: string;
}

export class FinancialService {
  // ─── INVOICE ─────────────────────────────────────────────────────────────────

  async createInvoice(params: CreateInvoiceParams, user: RequestUser) {
    return prisma.$transaction(async (tx) => {
      const client = await tx.client.findFirst({ where: { id: params.clientId, companyId: user.companyId } });
      if (!client) throw new NotFoundError('Cliente');

      if (params.serviceOrderId) {
        const os = await tx.serviceOrder.findFirst({ where: { id: params.serviceOrderId, companyId: user.companyId } });
        if (!os) throw new NotFoundError('OS');
      }

      const subtotal = params.items.reduce((s, i) => s + i.amount, 0);
      const discount = params.discount ?? 0;
      const tax = params.tax ?? 0;
      const total = subtotal - discount + tax;

      if (total < 0) throw new ValidationError('Total não pode ser negativo');

      const [{ nextNum }] = await tx.$queryRaw<Array<{ nextNum: number }>>`
        SELECT COALESCE(MAX(number), 0) + 1 AS "nextNum"
        FROM "Invoice"
        WHERE "companyId" = ${user.companyId}
      `;

      const invoice = await tx.invoice.create({
        data: {
          companyId: user.companyId,
          number: nextNum,
          clientId: params.clientId,
          serviceOrderId: params.serviceOrderId,
          status: 'ISSUED',
          subtotal: new Prisma.Decimal(subtotal),
          discount: new Prisma.Decimal(discount),
          tax: new Prisma.Decimal(tax),
          total: new Prisma.Decimal(total),
          dueDate: new Date(params.dueDate),
          notes: params.notes,
        },
      });

      await audit({
        companyId: user.companyId, userId: user.id,
        entity: 'Invoice', entityId: invoice.id,
        action: 'INVOICE_CREATED', after: { number: invoice.number, total },
      });

      return invoice;
    });
  }

  // ─── PAYMENT ─────────────────────────────────────────────────────────────────

  async createPayment(params: CreatePaymentParams, user: RequestUser) {
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: params.invoiceId, companyId: user.companyId },
        include: { payments: true },
      });
      if (!invoice) throw new NotFoundError('Fatura');
      if (invoice.status === 'CANCELLED') throw new AppError('Fatura cancelada', 422);

      const paidSoFar = invoice.payments
        .filter((p) => p.status === 'PAID')
        .reduce((s, p) => s + Number(p.netAmount), 0);

      const remaining = Number(invoice.total) - paidSoFar;
      const installments = params.installments ?? 1;

      if (params.amount > remaining + 0.01) {
        throw new AppError(`Valor excede o saldo devedor da fatura (R$ ${remaining.toFixed(2)})`, 422);
      }

      const installmentAmount = params.amount / installments;
      const interest = params.interest ?? 0;
      const fine = params.fine ?? 0;
      const discount = params.discount ?? 0;
      const netAmount = installmentAmount - discount + interest + fine;

      const payments = [];
      for (let i = 1; i <= installments; i++) {
        const dueDate = new Date(params.dueDate);
        dueDate.setMonth(dueDate.getMonth() + (i - 1));

        const payment = await tx.payment.create({
          data: {
            companyId: user.companyId,
            invoiceId: params.invoiceId,
            clientId: invoice.clientId,
            method: params.method,
            amount: new Prisma.Decimal(installmentAmount),
            discount: new Prisma.Decimal(discount),
            interest: new Prisma.Decimal(interest),
            fine: new Prisma.Decimal(fine),
            netAmount: new Prisma.Decimal(netAmount),
            dueDate,
            status: 'PENDING',
            installmentOf: installments > 1 ? installments : undefined,
            installmentNum: installments > 1 ? i : undefined,
            notes: params.notes,
          },
        });
        payments.push(payment);
      }

      await audit({
        companyId: user.companyId, userId: user.id,
        entity: 'Payment', entityId: payments[0].id,
        action: 'PAYMENT_CREATED', after: { installments, amount: params.amount, method: params.method },
      });

      return payments;
    });
  }

  async confirmPayment(paymentId: string, user: RequestUser) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, companyId: user.companyId },
        include: { invoice: true },
      });
      if (!payment) throw new NotFoundError('Pagamento');
      if (payment.status === 'PAID') throw new AppError('Pagamento já confirmado', 422);
      if (payment.status === 'CANCELLED') throw new AppError('Pagamento cancelado', 422);

      // Optimistic lock
      const result = await tx.payment.updateMany({
        where: { id: paymentId, companyId: user.companyId, version: payment.version },
        data: { status: 'PAID', paidAt: new Date(), version: { increment: 1 } },
      });
      if (result.count === 0) throw new ConcurrencyError();

      // Registrar movimento financeiro
      await tx.financialMovement.create({
        data: {
          companyId: user.companyId,
          type: 'INCOME',
          category: 'SERVICO',
          description: `Pagamento fatura #${payment.invoice.number}`,
          amount: payment.netAmount,
          paymentId,
          invoiceId: payment.invoiceId,
          userId: user.id,
        },
      });

      // Verificar se a fatura foi totalmente paga
      const allPayments = await tx.payment.findMany({
        where: { invoiceId: payment.invoiceId },
      });
      const totalPaid = allPayments
        .filter((p) => p.id === paymentId ? true : p.status === 'PAID')
        .reduce((s, p) => s + Number(p.netAmount), 0);

      const invoiceTotal = Number(payment.invoice.total);
      let newInvoiceStatus: InvoiceStatus = 'PARTIAL';
      if (totalPaid >= invoiceTotal - 0.01) newInvoiceStatus = 'PAID';

      await tx.invoice.updateMany({
        where: { id: payment.invoiceId, version: payment.invoice.version },
        data: { status: newInvoiceStatus, version: { increment: 1 } },
      });

      await audit({
        companyId: user.companyId, userId: user.id,
        entity: 'Payment', entityId: paymentId,
        action: 'PAYMENT_CONFIRMED',
        before: { status: payment.status },
        after: { status: 'PAID', paidAt: new Date() },
      });

      return tx.payment.findFirst({ where: { id: paymentId } });
    });
  }

  // Pagamentos nunca são deletados — somente cancelados
  async cancelPayment(params: CancelPaymentParams, user: RequestUser) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: params.paymentId, companyId: user.companyId },
        include: { invoice: true },
      });
      if (!payment) throw new NotFoundError('Pagamento');
      if (payment.status === 'CANCELLED') throw new AppError('Pagamento já cancelado', 422);
      if (payment.status === 'PAID') throw new AppError('Use estorno para pagamentos já confirmados', 422);

      const result = await tx.payment.updateMany({
        where: { id: params.paymentId, companyId: user.companyId, version: payment.version },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: user.id,
          cancelReason: params.reason,
          version: { increment: 1 },
        },
      });
      if (result.count === 0) throw new ConcurrencyError();

      // Reverter invoice para ISSUED se estava parcialmente paga
      const remainingPaid = (await tx.payment.findMany({
        where: { invoiceId: payment.invoiceId, status: 'PAID' },
      })).reduce((s, p) => s + Number(p.netAmount), 0);

      const invoiceStatus: InvoiceStatus = remainingPaid >= Number(payment.invoice.total) - 0.01
        ? 'PAID'
        : remainingPaid > 0
        ? 'PARTIAL'
        : 'ISSUED';

      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: { status: invoiceStatus },
      });

      await audit({
        companyId: user.companyId, userId: user.id,
        entity: 'Payment', entityId: params.paymentId,
        action: 'PAYMENT_CANCELLED', before: { status: payment.status }, after: { reason: params.reason },
      });

      return tx.payment.findFirst({ where: { id: params.paymentId } });
    });
  }

  async reversePayment(paymentId: string, reason: string, user: RequestUser) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, companyId: user.companyId },
        include: { invoice: true },
      });
      if (!payment) throw new NotFoundError('Pagamento');
      if (payment.status !== 'PAID') throw new AppError('Somente pagamentos confirmados podem ser estornados', 422);

      await tx.payment.updateMany({
        where: { id: paymentId, version: payment.version },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: user.id,
          cancelReason: `ESTORNO: ${reason}`,
          version: { increment: 1 },
        },
      });

      await tx.financialMovement.create({
        data: {
          companyId: user.companyId,
          type: 'REFUND',
          category: 'SERVICO',
          description: `Estorno pagamento ${paymentId}: ${reason}`,
          amount: payment.netAmount,
          paymentId,
          invoiceId: payment.invoiceId,
          userId: user.id,
        },
      });

      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: { status: 'ISSUED' },
      });

      await audit({
        companyId: user.companyId, userId: user.id,
        entity: 'Payment', entityId: paymentId,
        action: 'PAYMENT_REVERSED', before: { status: 'PAID' }, after: { reason },
      });

      return { success: true };
    });
  }

  // ─── REPORTS ──────────────────────────────────────────────────────────────────

  async financialSummary(companyId: string, from: Date, to: Date) {
    const [income, expense, pending] = await Promise.all([
      prisma.financialMovement.aggregate({
        where: { companyId, type: 'INCOME', movementDate: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      prisma.financialMovement.aggregate({
        where: { companyId, type: 'EXPENSE', movementDate: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { companyId, status: 'PENDING', dueDate: { gte: from, lte: to } },
        _sum: { netAmount: true },
      }),
    ]);

    const totalIncome = Number(income._sum.amount ?? 0);
    const totalExpense = Number(expense._sum.amount ?? 0);
    const totalPending = Number(pending._sum.netAmount ?? 0);

    return {
      totalIncome,
      totalExpense,
      netResult: totalIncome - totalExpense,
      totalPending,
      period: { from, to },
    };
  }

  async listInvoices(params: {
    companyId: string;
    status?: InvoiceStatus;
    clientId?: string;
    from?: Date;
    to?: Date;
    page?: number;
    limit?: number;
  }) {
    const { page, limit, skip } = parsePagination(params);
    const where: Prisma.InvoiceWhereInput = { companyId: params.companyId };
    if (params.status) where.status = params.status;
    if (params.clientId) where.clientId = params.clientId;
    if (params.from || params.to) {
      where.dueDate = {};
      if (params.from) where.dueDate.gte = params.from;
      if (params.to) where.dueDate.lte = params.to;
    }

    const [data, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        include: {
          client: { select: { id: true, name: true } },
          payments: { select: { id: true, status: true, netAmount: true, paidAt: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async overdueCheck(companyId: string) {
    return prisma.$transaction(async (tx) => {
      const cutoff = new Date();
      const paymentResult = await tx.payment.updateMany({
        where: {
          companyId,
          status: 'PENDING',
          dueDate: { lt: cutoff },
        },
        data: { status: 'OVERDUE' },
      });

      const invoiceResult = await tx.invoice.updateMany({
        where: {
          companyId,
          status: { in: ['ISSUED', 'PARTIAL'] },
          dueDate: { lt: cutoff },
        },
        data: { status: 'OVERDUE' },
      });

      return { paymentsUpdated: paymentResult.count, invoicesUpdated: invoiceResult.count };
    });
  }
}
