import { FastifyRequest, FastifyReply } from 'fastify';
import dayjs from 'dayjs';
import { prisma } from '../lib/prisma';

function hashTeam(s: string): number {
  let h = 0;
  for (const c of s) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

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

  async teamLocations(_request: FastifyRequest, reply: FastifyReply) {
    const technicians = await prisma.technician.findMany({
      where: { isActive: true },
      include: {
        serviceOrders: {
          where: { status: { in: ['IN_PROGRESS', 'OPEN'] } },
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: { number: true },
        },
      },
    });

    const teamMap = new Map<string, { members: string[]; os: string; inProgress: boolean }>();
    for (const tech of technicians) {
      const team = tech.team || 'Sem equipe';
      const activeOS = tech.serviceOrders[0];
      if (!teamMap.has(team)) {
        teamMap.set(team, {
          members: [tech.name],
          os: activeOS ? `OS-${activeOS.number}` : 'Sem OS',
          inProgress: tech.statusField !== 'Disponivel',
        });
      } else {
        const entry = teamMap.get(team)!;
        entry.members.push(tech.name);
        if (tech.statusField !== 'Disponivel') entry.inProgress = true;
        if (entry.os === 'Sem OS' && activeOS) entry.os = `OS-${activeOS.number}`;
      }
    }

    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const locations = Array.from(teamMap.entries()).map(([team, info]) => {
      const h = hashTeam(team);
      const baseX = 15 + (h % 68);
      const baseY = 15 + ((h >> 8) % 62);
      return {
        team,
        members: info.members.join(', ') || 'Sem tecnico',
        x: Math.min(88, Math.max(8, baseX + Math.floor(Math.random() * 7) - 3)),
        y: Math.min(82, Math.max(14, baseY + Math.floor(Math.random() * 7) - 3)),
        speed: info.inProgress ? 20 + Math.floor(Math.random() * 50) : 0,
        status: info.inProgress ? 'Em rota' : 'Disponivel',
        vehicle: `Veiculo ${team.replace(/\D/g, '') || '1'}`,
        updated: time,
        currentOS: info.os,
      };
    });

    return reply.send(locations);
  }

  async attendantReport(_request: FastifyRequest, reply: FastifyReply) {
    const [users, osByCreator, pendingByCreator] = await Promise.all([
      prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'ATTENDANT'] }, active: true },
        select: { id: true, email: true, role: true, createdAt: true },
        orderBy: { email: 'asc' },
      }),
      prisma.serviceOrder.groupBy({
        by: ['createdById'],
        _count: { id: true },
        where: { createdById: { not: null } },
      }),
      prisma.serviceOrder.groupBy({
        by: ['createdById'],
        _count: { id: true },
        where: {
          createdById: { not: null },
          status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_PARTS'] },
        },
      }),
    ]);

    const totalMap = new Map(osByCreator.map((r) => [r.createdById, r._count.id]));
    const pendingMap = new Map(pendingByCreator.map((r) => [r.createdById, r._count.id]));

    const rows = users.map((u) => ({
      name: u.email.split('@')[0],
      email: u.email,
      role: u.role,
      instructed: totalMap.get(u.id) ?? 0,
      redirected: 0,
      pending: pendingMap.get(u.id) ?? 0,
      last: u.createdAt.toLocaleDateString('pt-BR'),
    }));

    return reply.send(rows);
  }

  async listUsers(_request: FastifyRequest, reply: FastifyReply) {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, role: true, active: true, createdAt: true },
      orderBy: { email: 'asc' },
    });
    return reply.send(users);
  }
}
