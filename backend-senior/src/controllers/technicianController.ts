import { FastifyRequest, FastifyReply } from 'fastify';
import { TechnicianService, createTechnicianSchema, updateTechnicianSchema } from '../services/technicianService';

const service = new TechnicianService();

export class TechnicianController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = createTechnicianSchema.parse(request.body);
    return reply.status(201).send(await service.create(data));
  }

  async list(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await service.list());
  }

  async findById(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    return reply.send(await service.findById(request.params.id));
  }

  async update(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const data = updateTechnicianSchema.parse(request.body);
    return reply.send(await service.update(request.params.id, data));
  }

  async deactivate(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    return reply.send(await service.deactivate(request.params.id));
  }
}
