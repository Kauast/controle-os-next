import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/auth';

interface RequestUser { companyId: string; }

export async function listTeams(companyId: string) {
  const teams = await prisma.team.findMany({
    where: { companyId, active: true, deletedAt: null },
    include: {
      members: {
        include: {
          technician: { select: { id: true, name: true, status: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    members: t.members.map((m) => ({
      id: m.technician.id,
      name: m.technician.name,
    })),
    online: t.members.some((m) => m.technician.status === 'AVAILABLE'),
  }));
}

export default async function teamRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.get('/', async (req, reply) => {
    const user = req.user as RequestUser;
    const teams = await listTeams(user.companyId);
    return reply.send(teams);
  });
}
