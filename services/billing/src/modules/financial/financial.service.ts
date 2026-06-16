import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { parsePagination, buildPaginatedResult } from '../../lib/pagination';
import type { ListMovementsQueryType, SummaryQueryType } from './financial.schema';

interface RequestContext {
  companyId: string;
}

export class FinancialService {
  async listMovements(query: ListMovementsQueryType, ctx: RequestContext) {
    const { page, limit, skip } = parsePagination(query);

    const where: Prisma.FinancialMovementWhereInput = { companyId: ctx.companyId };
    if (query.type) where.type = query.type;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate)   where.createdAt.lte = new Date(query.endDate);
    }

    const [data, total] = await Promise.all([
      prisma.financialMovement.findMany({
        where,
        skip,
        take:    limit,
        include: { invoice: { select: { id: true, clientName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.financialMovement.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async summary(query: SummaryQueryType, ctx: RequestContext) {
    const dateFilter: Prisma.DateTimeFilter<'FinancialMovement'> = {};
    if (query.startDate) dateFilter.gte = new Date(query.startDate);
    if (query.endDate)   dateFilter.lte = new Date(query.endDate);

    const baseWhere: Prisma.FinancialMovementWhereInput = {
      companyId: ctx.companyId,
      ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
    };

    const [income, expense, refund] = await Promise.all([
      prisma.financialMovement.aggregate({
        where: { ...baseWhere, type: 'INCOME' },
        _sum:  { amount: true },
        _count: true,
      }),
      prisma.financialMovement.aggregate({
        where: { ...baseWhere, type: 'EXPENSE' },
        _sum:  { amount: true },
        _count: true,
      }),
      prisma.financialMovement.aggregate({
        where: { ...baseWhere, type: 'REFUND' },
        _sum:  { amount: true },
        _count: true,
      }),
    ]);

    const totalIncome  = income._sum.amount  ?? 0;
    const totalExpense = expense._sum.amount ?? 0;
    const totalRefund  = refund._sum.amount  ?? 0;

    return {
      income:    { total: totalIncome,  count: income._count },
      expense:   { total: totalExpense, count: expense._count },
      refund:    { total: totalRefund,  count: refund._count },
      netResult: totalIncome - totalExpense - totalRefund,
      period: {
        startDate: query.startDate ?? null,
        endDate:   query.endDate   ?? null,
      },
    };
  }
}

export const financialService = new FinancialService();
