import { FastifyRequest, FastifyReply } from 'fastify';
import dayjs from 'dayjs';
import { prisma } from '../lib/prisma';

export class ReportController {
  async teamReport(
    request: FastifyRequest<{ Querystring: { team?: string } }>,
    reply: FastifyReply
  ) {
    const { team } = request.query;

    const technicians = await prisma.technician.findMany({
      where: {
        isActive: true,
        ...(team && team !== 'all' ? { team } : {}),
      },
      include: {
        serviceOrders: {
          select: { id: true, status: true, completionDate: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const rows = technicians.map((tech) => {
      const completed = tech.serviceOrders.filter((o) => o.status === 'COMPLETED').length;
      const total = tech.serviceOrders.length;
      return {
        team: tech.team || tech.name,
        technicianId: tech.id,
        name: tech.name,
        completed,
        total,
        status: tech.statusField,
        pill: tech.statusField === 'Disponivel' ? 'teal' : 'amber',
      };
    });

    return reply.send(rows);
  }

  async financeSummary(_request: FastifyRequest, reply: FastifyReply) {
    const sixMonthsAgo = dayjs().subtract(5, 'month').startOf('month').toDate();

    const [products, completedOrders, openOrders] = await Promise.all([
      prisma.product.findMany({ select: { stockQuantity: true, cost: true } }),
      prisma.serviceOrder.findMany({
        where: { status: 'COMPLETED', completionDate: { gte: sixMonthsAgo } },
        include: { items: true },
        orderBy: { completionDate: 'asc' },
      }),
      prisma.serviceOrder.findMany({
        where: { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_PARTS'] } },
        include: { items: true },
      }),
    ]);

    const stockValue = products.reduce((sum, p) => sum + p.stockQuantity * Number(p.cost), 0);

    const materialSold = completedOrders.reduce((sum, os) => {
      return sum + os.items
        .filter((i) => i.itemType === 'PRODUCT')
        .reduce((s, i) => s + i.quantity * Number(i.unitPrice), 0);
    }, 0);

    const servicesScheduled = completedOrders.reduce((sum, os) => {
      return sum + os.items
        .filter((i) => i.itemType === 'SERVICE')
        .reduce((s, i) => s + i.quantity * Number(i.unitPrice), 0);
    }, 0);

    const forecast = openOrders.reduce((sum, os) => sum + Number(os.totalAmount), 0);

    // Agrupa os últimos 6 meses
    const monthlyMap = new Map<string, { material: number; services: number }>();
    for (let i = 5; i >= 0; i--) {
      monthlyMap.set(dayjs().subtract(i, 'month').format('YYYY-MM'), { material: 0, services: 0 });
    }

    for (const os of completedOrders) {
      const key = dayjs(os.completionDate!).format('YYYY-MM');
      const entry = monthlyMap.get(key);
      if (!entry) continue;
      entry.material += os.items
        .filter((i) => i.itemType === 'PRODUCT')
        .reduce((s, i) => s + i.quantity * Number(i.unitPrice), 0);
      entry.services += os.items
        .filter((i) => i.itemType === 'SERVICE')
        .reduce((s, i) => s + i.quantity * Number(i.unitPrice), 0);
    }

    const monthly = Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      material: data.material,
      services: data.services,
      forecast: 0,
      stock: stockValue,
    }));

    return reply.send({ materialSold, servicesScheduled, forecast, stockValue, monthly });
  }
}
