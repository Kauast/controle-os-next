import { FastifyRequest, FastifyReply } from 'fastify';
import { TechnicianService } from './technicians.service';
import {
  createTechnicianSchema,
  updateTechnicianSchema,
  updateTechnicianStatusSchema,
  listTechniciansQuerySchema,
} from './technicians.schema';
import { AppError } from '../../lib/errors';

const service = new TechnicianService();

interface JwtUser {
  id: string;
  companyId: string;
  role: string;
}

export class TechnicianController {
  async list(req: FastifyRequest, reply: FastifyReply) {
    const user = req.user as JwtUser;
    const query = listTechniciansQuerySchema.parse(req.query);
    const result = await service.list(user.companyId, query);
    return reply.send(result);
  }

  async findById(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = req.user as JwtUser;
    const technician = await service.findById(req.params.id, user.companyId);
    return reply.send(technician);
  }

  async getCapacity(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = req.user as JwtUser;
    const capacity = await service.getCapacity(req.params.id, user.companyId);
    return reply.send(capacity);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const user = req.user as JwtUser;
    const body = createTechnicianSchema.parse({ ...(req.body as object), companyId: user.companyId });
    const technician = await service.create(body);
    return reply.status(201).send(technician);
  }

  async update(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = req.user as JwtUser;
    const body = updateTechnicianSchema.parse(req.body);
    const technician = await service.update(req.params.id, user.companyId, body);
    return reply.send(technician);
  }

  async updateStatus(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = req.user as JwtUser;
    const body = updateTechnicianStatusSchema.parse(req.body);
    const technician = await service.updateStatus(req.params.id, user.companyId, body.status);
    return reply.send(technician);
  }

  async delete(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = req.user as JwtUser;
    await service.softDelete(req.params.id, user.companyId);
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
