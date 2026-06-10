import { FastifyRequest, FastifyReply } from 'fastify';
import { Status, Priority } from '@prisma/client';
import {
  ServiceOrderService,
  createOSSchema,
  updateExecutionSchema,
} from '../services/serviceOrderService';

const service = new ServiceOrderService();

export class ServiceOrderController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = createOSSchema.parse(request.body);
    const user = request.user as { id: string };
    const result = await service.create(data, user.id);
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

  async assign(
    request: FastifyRequest<{
      Params: { id: string };
      Body: { team: string; technicianId?: string | null };
    }>,
    reply: FastifyReply
  ) {
    const { id } = request.params;
    const { team, technicianId } = request.body;
    const result = await service.assign(id, team, technicianId);
    return reply.send(result);
  }

  async updateExecution(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params;
    const data = updateExecutionSchema.parse(request.body);
    const result = await service.updateExecution(id, data);
    return reply.send(result);
  }

  async list(
    request: FastifyRequest<{
      Querystring: {
        status?: string;
        priority?: string;
        team?: string;
        technicianId?: string;
        page?: string;
        limit?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    const { status, priority, team, technicianId, page, limit } = request.query;
    const result = await service.list({
      status: status as Status | undefined,
      priority: priority as Priority | undefined,
      team,
      technicianId,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
    return reply.send(result);
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const result = await service.delete(request.params.id);
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
