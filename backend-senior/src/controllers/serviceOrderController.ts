import { FastifyRequest, FastifyReply } from 'fastify';
import { Status } from '@prisma/client';
import { ServiceOrderService, createOSSchema } from '../services/serviceOrderService';

const service = new ServiceOrderService();

export class ServiceOrderController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = createOSSchema.parse(request.body);
    const result = await service.create(data);
    return reply.status(201).send(result);
  }

  async updateStatus(
    request: FastifyRequest<{
      Params: { id: string };
      Body: { status: string; cancellationReason?: string };
    }>,
    reply: FastifyReply
  ) {
    const { id } = request.params;
    const { status, cancellationReason } = request.body;
    const result = await service.updateStatus(id, status as Status, cancellationReason);
    return reply.send(result);
  }

  async list(
    request: FastifyRequest<{
      Querystring: { status?: string; page?: string; limit?: string };
    }>,
    reply: FastifyReply
  ) {
    const { status, page, limit } = request.query;
    const result = await service.list({
      status: status as Status | undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    });
    return reply.send(result);
  }

  async findById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const result = await service.findById(request.params.id);
    return reply.send(result);
  }
}
