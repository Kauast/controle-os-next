import { FastifyRequest, FastifyReply } from 'fastify';
import { TechnicianService, createTechnicianSchema, updateTechnicianSchema } from '../modules/technician/technician.service';

const service = new TechnicianService();

interface RequestUser {
  id: string;
  companyId: string;
}

export class TechnicianController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = createTechnicianSchema.parse(request.body);
    const user = request.user as RequestUser;
    return reply.status(201).send(await service.create(data, user));
  }

  async list(
    request: FastifyRequest<{ Querystring: { search?: string; isActive?: string } }>,
    reply: FastifyReply
  ) {
    const { search, isActive } = request.query;
    const user = request.user as RequestUser;
    return reply.send(
      await service.list({
        companyId: user.companyId,
        search,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
      })
    );
  }

  async findById(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = request.user as RequestUser;
    return reply.send(await service.findById(request.params.id, user.companyId));
  }

  async update(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const data = updateTechnicianSchema.parse(request.body);
    const user = request.user as RequestUser;
    return reply.send(await service.update(request.params.id, data, user));
  }

  async deactivate(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = request.user as RequestUser;
    return reply.send(await service.delete(request.params.id, user));
  }
}
