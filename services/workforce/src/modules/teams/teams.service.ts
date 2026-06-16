import { prisma } from '../../lib/prisma';
import { NotFoundError, ConflictError } from '../../lib/errors';
import { parsePagination, buildPaginatedResult } from '../../lib/pagination';
import type {
  CreateTeamInput,
  UpdateTeamInput,
  AddTeamMemberInput,
  ListTeamsQuery,
} from './teams.schema';

export class TeamService {
  async create(companyId: string, data: CreateTeamInput) {
    return prisma.team.create({
      data: { companyId, name: data.name },
      include: { members: { include: { technician: true } } },
    });
  }

  async list(companyId: string, query: ListTeamsQuery) {
    const { page, limit, skip } = parsePagination(query);

    const where: Record<string, unknown> = { companyId };
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [data, total] = await Promise.all([
      prisma.team.findMany({
        where,
        skip,
        take: limit,
        include: {
          members: {
            include: {
              technician: {
                select: { id: true, name: true, status: true, specialties: true },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.team.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findById(id: string, companyId: string) {
    const team = await prisma.team.findFirst({
      where: { id, companyId },
      include: {
        members: {
          include: {
            technician: {
              select: { id: true, name: true, email: true, status: true, specialties: true },
            },
          },
        },
      },
    });

    if (!team) throw new NotFoundError('Time');
    return team;
  }

  async update(id: string, companyId: string, data: UpdateTeamInput) {
    const team = await prisma.team.findFirst({ where: { id, companyId } });
    if (!team) throw new NotFoundError('Time');

    return prisma.team.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: { members: { include: { technician: true } } },
    });
  }

  async delete(id: string, companyId: string) {
    const team = await prisma.team.findFirst({ where: { id, companyId } });
    if (!team) throw new NotFoundError('Time');

    // Remove membros antes de excluir o time
    await prisma.teamMember.deleteMany({ where: { teamId: id } });
    await prisma.team.delete({ where: { id } });

    return { success: true };
  }

  async addMember(teamId: string, companyId: string, data: AddTeamMemberInput) {
    const team = await prisma.team.findFirst({ where: { id: teamId, companyId } });
    if (!team) throw new NotFoundError('Time');

    const technician = await prisma.technician.findFirst({
      where: { id: data.technicianId, companyId, deletedAt: null },
    });
    if (!technician) throw new NotFoundError('Técnico');

    const existingMember = await prisma.teamMember.findUnique({
      where: { teamId_technicianId: { teamId, technicianId: data.technicianId } },
    });
    if (existingMember) throw new ConflictError('Técnico já é membro deste time');

    return prisma.teamMember.create({
      data: {
        teamId,
        technicianId: data.technicianId,
        role: data.role ?? null,
      },
      include: {
        technician: { select: { id: true, name: true, status: true } },
        team: { select: { id: true, name: true } },
      },
    });
  }

  async removeMember(teamId: string, companyId: string, technicianId: string) {
    const team = await prisma.team.findFirst({ where: { id: teamId, companyId } });
    if (!team) throw new NotFoundError('Time');

    const member = await prisma.teamMember.findUnique({
      where: { teamId_technicianId: { teamId, technicianId } },
    });
    if (!member) throw new NotFoundError('Membro do time');

    await prisma.teamMember.delete({
      where: { teamId_technicianId: { teamId, technicianId } },
    });

    return { success: true };
  }
}
