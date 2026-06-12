import { FastifyRequest, FastifyReply } from 'fastify';
import dayjs from 'dayjs';
import { prisma } from '../lib/prisma';
import { StockService } from '../modules/stock/stock.service';

const stockService = new StockService();

function hashTeam(s: string): number {
  let h = 0;
  for (const c of s) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export class ReportController {
  async teamReport(
    request: FastifyRequest<{ Querystring: { team?: string; companyId?: string } }>,
    reply: FastifyReply
  ) {
    const { team, companyId } = request.query;
    const user = request.user as { id: string; companyId: string };
    const cid = companyId ?? user.companyId;

    const technicians = await prisma.technician.findMany({
      where: {
        companyId: cid,
        isActive: true,
        ...(team && team !== 'all'
          ? { teamMemberships: { some: { team: { name: team } } } }
          : {}),
      },
      include: {
        teamMemberships: { include: { team: { select: { name: true } } }, take: 1 },
        serviceOrders: {
          where: { companyId: cid },
          select: { id: true, status: true, completionDate: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const statusLabel: Record<string, string> = {
      AVAILABLE: 'Disponivel',
      BUSY: 'Ocupado',
      OFF: 'Folga',
      VACATION: 'Ferias',
    };

    const rows = technicians.map((tech) => {
      const completed = tech.serviceOrders.filter((o) => o.status === 'COMPLETED').length;
      const total = tech.serviceOrders.length;
      const teamName = tech.teamMemberships[0]?.team?.name ?? tech.name;
      const statusStr = statusLabel[tech.status] ?? tech.status;
      return {
        team: teamName,
        technicianId: tech.id,
        name: tech.name,
        completed,
        total,
        status: statusStr,
        pill: tech.status === 'AVAILABLE' ? 'teal' : 'amber',
      };
    });

    return reply.send(rows);
  }

  async financeSummary(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const user = request.user as { id: string; companyId: string };
    const sixMonthsAgo = dayjs().subtract(5, 'month').startOf('month').toDate();

    const [products, completedOrders, openOrders] = await Promise.all([
      prisma.product.findMany({
        where: { companyId: user.companyId, deletedAt: null },
        select: { id: true, cost: true },
      }),
      prisma.serviceOrder.findMany({
        where: { companyId: user.companyId, status: 'COMPLETED', completionDate: { gte: sixMonthsAgo } },
        include: { items: true },
        orderBy: { completionDate: 'asc' },
      }),
      prisma.serviceOrder.findMany({
        where: { companyId: user.companyId, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_PARTS'] } },
        include: { items: true },
      }),
    ]);

    // Calcula valor do estoque somando balances (simplificado: usa último movimento de cada produto)
    let stockValue = 0;
    for (const p of products) {
      const balance = await stockService.getBalance(p.id);
      stockValue += balance.physical * Number(p.cost);
    }

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

  async teamLocations(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const user = request.user as { id: string; companyId: string };

    const technicians = await prisma.technician.findMany({
      where: { companyId: user.companyId, isActive: true },
      include: {
        teamMemberships: { include: { team: { select: { name: true } } }, take: 1 },
        serviceOrders: {
          where: { companyId: user.companyId, status: { in: ['IN_PROGRESS', 'OPEN'] } },
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: { number: true },
        },
      },
    });

    const statusLabel: Record<string, string> = {
      AVAILABLE: 'Disponivel',
      BUSY: 'Em rota',
      OFF: 'Folga',
      VACATION: 'Ferias',
    };

    const teamMap = new Map<string, { members: string[]; os: string; inProgress: boolean }>();
    for (const tech of technicians) {
      const teamName = tech.teamMemberships[0]?.team?.name ?? 'Sem equipe';
      const activeOS = tech.serviceOrders[0];
      const inProgress = tech.status !== 'AVAILABLE';
      if (!teamMap.has(teamName)) {
        teamMap.set(teamName, {
          members: [tech.name],
          os: activeOS ? `OS-${activeOS.number}` : 'Sem OS',
          inProgress,
        });
      } else {
        const entry = teamMap.get(teamName)!;
        entry.members.push(tech.name);
        if (inProgress) entry.inProgress = true;
        if (entry.os === 'Sem OS' && activeOS) entry.os = `OS-${activeOS.number}`;
      }
    }

    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const locations = Array.from(teamMap.entries()).map(([teamName, info]) => {
      const h = hashTeam(teamName);
      const baseX = 15 + (h % 68);
      const baseY = 15 + ((h >> 8) % 62);
      return {
        team: teamName,
        members: info.members.join(', ') || 'Sem tecnico',
        x: Math.min(88, Math.max(8, baseX + Math.floor(Math.random() * 7) - 3)),
        y: Math.min(82, Math.max(14, baseY + Math.floor(Math.random() * 7) - 3)),
        speed: info.inProgress ? 20 + Math.floor(Math.random() * 50) : 0,
        status: info.inProgress ? statusLabel.BUSY : statusLabel.AVAILABLE,
        vehicle: `Veiculo ${teamName.replace(/\D/g, '') || '1'}`,
        updated: time,
        currentOS: info.os,
      };
    });

    return reply.send(locations);
  }

  async attendantReport(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as { id: string; companyId: string };

    const [users, osByCreator, pendingByCreator] = await Promise.all([
      prisma.user.findMany({
        where: { companyId: user.companyId, role: { in: ['ADMIN', 'ATTENDANT'] }, active: true },
        select: { id: true, email: true, role: true, createdAt: true },
        orderBy: { email: 'asc' },
      }),
      prisma.serviceOrder.groupBy({
        by: ['createdById'],
        _count: { id: true },
        where: { companyId: user.companyId, createdById: { not: null } },
      }),
      prisma.serviceOrder.groupBy({
        by: ['createdById'],
        _count: { id: true },
        where: {
          companyId: user.companyId,
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

  async listUsers(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as { id: string; companyId: string };
    const users = await prisma.user.findMany({
      where: { companyId: user.companyId },
      select: { id: true, email: true, role: true, active: true, createdAt: true },
      orderBy: { email: 'asc' },
    });
    return reply.send(users);
  }
}
