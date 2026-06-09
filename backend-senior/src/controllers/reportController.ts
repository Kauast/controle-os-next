import { FastifyRequest, FastifyReply } from 'fastify';
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
    const [products, serviceOrders] = await Promise.all([
      prisma.product.findMany({ select: { stockQuantity: true, cost: true, price: true } }),
      prisma.serviceOrder.findMany({
        where: { status: 'COMPLETED' },
        include: { items: true },
        orderBy: { completionDate: 'desc' },
      }),
    ]);

    const stockValue = products.reduce((sum, p) => sum + p.stockQuantity * Number(p.cost), 0);

    const materialSold = serviceOrders.reduce((sum, os) => {
      const mat = os.items
        .filter((i) => i.itemType === 'PRODUCT')
        .reduce((s, i) => s + i.quantity * Number(i.unitPrice), 0);
      return sum + mat;
    }, 0);

    const servicesScheduled = serviceOrders.reduce((sum, os) => {
      const svc = os.items
        .filter((i) => i.itemType === 'SERVICE')
        .reduce((s, i) => s + i.quantity * Number(i.unitPrice), 0);
      return sum + svc;
    }, 0);

    const openOrders = await prisma.serviceOrder.findMany({
      where: { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_PARTS'] } },
      include: { items: true },
    });

    const forecast = openOrders.reduce((sum, os) => sum + Number(os.totalAmount), 0);

    return reply.send({
      materialSold,
      servicesScheduled,
      forecast,
      stockValue,
      monthly: [],
    });
  }
}
