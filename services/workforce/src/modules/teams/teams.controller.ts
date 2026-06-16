import { FastifyRequest, FastifyReply } from 'fastify';
import { TeamService } from './teams.service';
import {
  createTeamSchema,
  updateTeamSchema,
  addTeamMemberSchema,
  listTeamsQuerySchema,
} from './teams.schema';
import { AppError } from '../../lib/errors';

const service = new TeamService();

interface JwtUser {
  id: string;
  companyId: string;
  role: string;
}

export class TeamController {
  async list(req: FastifyRequest, reply: FastifyReply) {
    const user = req.user as JwtUser;
    const query = listTeamsQuerySchema.parse(req.query);
    const result = await service.list(user.companyId, query);
    return reply.send(result);
  }

  async findById(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = req.user as JwtUser;
    const team = await service.findById(req.params.id, user.companyId);
    return reply.send(team);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const user = req.user as JwtUser;
    const body = createTeamSchema.parse(req.body);
    const team = await service.create(user.companyId, body);
    return reply.status(201).send(team);
  }

  async update(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = req.user as JwtUser;
    const body = updateTeamSchema.parse(req.body);
    const team = await service.update(req.params.id, user.companyId, body);
    return reply.send(team);
  }

  async delete(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = req.user as JwtUser;
    await service.delete(req.params.id, user.companyId);
    return reply.status(204).send();
  }

  async addMember(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const user = req.user as JwtUser;
    const body = addTeamMemberSchema.parse(req.body);
    const member = await service.addMember(req.params.id, user.companyId, body);
    return reply.status(201).send(member);
  }

  async removeMember(
    req: FastifyRequest<{ Params: { id: string; technicianId: string } }>,
    reply: FastifyReply,
  ) {
    const user = req.user as JwtUser;
    await service.removeMember(req.params.id, user.companyId, req.params.technicianId);
    return reply.status(204).send();
  }
}

export function handleError(err: unknown, req: FastifyRequest, reply: FastifyReply) {
  if (err instanceof AppError) {
    return reply.status(err.statusCode).send({
      error: err.name,
      message: err.message,
      code: err.code,
    });
  }
  req.log.error(err);
  return reply.status(500).send({ error: 'InternalServerError', message: 'Erro interno do servidor' });
}
