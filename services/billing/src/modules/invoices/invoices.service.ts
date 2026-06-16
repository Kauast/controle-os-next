import { InvoiceStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { publish } from '../../lib/publisher';
import { NotFoundError, UnprocessableError } from '../../lib/errors';
import { parsePagination, buildPaginatedResult } from '../../lib/pagination';
import { invoicesTotal } from '../../lib/metrics';
import type { CreateInvoiceBodyType, ListInvoicesQueryType } from './invoices.schema';

interface RequestContext {
  companyId: string;
}

export class InvoicesService {
  async list(query: ListInvoicesQueryType, ctx: RequestContext) {
    const { page, limit, skip } = parsePagination(query);

    const where: Prisma.InvoiceWhereInput = { companyId: ctx.companyId };
    if (query.status)         where.status         = query.status;
    if (query.clientId)       where.clientId       = query.clientId;
    if (query.serviceOrderId) where.serviceOrderId = query.serviceOrderId;

    const [data, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        include: {
          payments: {
            select: { id: true, status: true, amount: true, method: true, paidAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findById(id: string, ctx: RequestContext) {
    const invoice = await prisma.invoice.findFirst({
      where: { id, companyId: ctx.companyId },
      include: {
        payments:  true,
        movements: true,
      },
    });
    if (!invoice) throw new NotFoundError('Fatura');
    return invoice;
  }

  async create(body: CreateInvoiceBodyType, ctx: RequestContext) {
    const subtotal = body.items.reduce((acc, i) => acc + i.qty * i.unitPrice, 0);
    const discount = body.discount ?? 0;
    const total    = subtotal - discount;

    if (total < 0) throw new UnprocessableError('Total não pode ser negativo');

    const invoice = await prisma.invoice.create({
      data: {
        companyId:      ctx.companyId,
        serviceOrderId: body.serviceOrderId,
        clientId:       body.clientId,
        clientName:     body.clientName,
        subtotal,
        discount,
        total,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        note:    body.note,
        status:  'DRAFT',
      },
    });

    invoicesTotal.inc({ event: 'created' });
    return invoice;
  }

  async issue(id: string, ctx: RequestContext) {
    const invoice = await prisma.invoice.findFirst({
      where: { id, companyId: ctx.companyId },
    });
    if (!invoice) throw new NotFoundError('Fatura');
    if (invoice.status !== 'DRAFT') {
      throw new UnprocessableError(`Apenas faturas em rascunho podem ser emitidas. Status atual: ${invoice.status}`);
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data:  { status: 'ISSUED', issuedAt: new Date() },
    });

    invoicesTotal.inc({ event: 'issued' });

    // Publicar evento de forma não-bloqueante — falha de publish não reverte a DB
    publish('invoice.issued', {
      invoiceId:      updated.id,
      companyId:      updated.companyId,
      clientId:       updated.clientId,
      clientName:     updated.clientName,
      serviceOrderId: updated.serviceOrderId,
      total:          updated.total,
      issuedAt:       updated.issuedAt,
    }).catch((err) => console.error('[invoices.service] Falha ao publicar invoice.issued:', err));

    return updated;
  }

  async cancel(id: string, ctx: RequestContext) {
    const invoice = await prisma.invoice.findFirst({
      where: { id, companyId: ctx.companyId },
    });
    if (!invoice) throw new NotFoundError('Fatura');
    if (invoice.status === 'CANCELLED') {
      throw new UnprocessableError('Fatura já está cancelada');
    }
    if (invoice.status === 'PAID') {
      throw new UnprocessableError('Fatura paga não pode ser cancelada');
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data:  { status: 'CANCELLED', cancelledAt: new Date() },
    });

    invoicesTotal.inc({ event: 'cancelled' });

    publish('invoice.cancelled', {
      invoiceId:  updated.id,
      companyId:  updated.companyId,
      cancelledAt: updated.cancelledAt,
    }).catch((err) => console.error('[invoices.service] Falha ao publicar invoice.cancelled:', err));

    return updated;
  }

  // Chamado pelo cron — marca como OVERDUE e publica evento por fatura
  async markOverdue(): Promise<number> {
    const now = new Date();

    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status:  { in: ['ISSUED', 'PARTIALLY_PAID'] },
        dueDate: { lt: now },
      },
      select: { id: true, companyId: true, clientId: true, dueDate: true },
    });

    if (overdueInvoices.length === 0) return 0;

    await prisma.invoice.updateMany({
      where: {
        id:     { in: overdueInvoices.map((i) => i.id) },
        status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
      },
      data: { status: 'OVERDUE' },
    });

    // Publica um evento por fatura vencida
    for (const inv of overdueInvoices) {
      publish('invoice.overdue', {
        invoiceId: inv.id,
        companyId: inv.companyId,
        clientId:  inv.clientId,
        dueDate:   inv.dueDate,
      }).catch((err) => console.error('[invoices.service] Falha ao publicar invoice.overdue:', err));
    }

    invoicesTotal.inc({ event: 'overdue' }, overdueInvoices.length);
    return overdueInvoices.length;
  }
}

export const invoicesService = new InvoicesService();
