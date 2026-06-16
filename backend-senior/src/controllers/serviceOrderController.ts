import { FastifyRequest, FastifyReply } from 'fastify';
import { OrderStatus, Priority } from '@prisma/client';
import {
  ServiceOrderService,
  createOSSchema,
  updateExecutionSchema,
  updateStatusSchema,
  assignSchema,
} from '../services/serviceOrderService';

const service = new ServiceOrderService();

interface RequestUser {
  id: string;
  role: string;
  companyId: string;
}

export class ServiceOrderController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = createOSSchema.parse(request.body);
    const user = request.user as RequestUser;
    const result = await service.create(data, user);
    return reply.status(201).send(result);
  }

  async updateStatus(
    request: FastifyRequest<{
      Params: { id: string };
      Body: { status: string; cancellationReason?: string; note?: string };
    }>,
    reply: FastifyReply
  ) {
    const { id } = request.params;
    const input = updateStatusSchema.parse(request.body);
    const user = request.user as RequestUser;
    const result = await service.updateStatus(id, input, user);
    return reply.send(result);
  }

  async assign(
    request: FastifyRequest<{
      Params: { id: string };
      Body: { technicianId?: string | null; teamId?: string | null };
    }>,
    reply: FastifyReply
  ) {
    const { id } = request.params;
    const input = assignSchema.parse(request.body);
    const user = request.user as RequestUser;
    const result = await service.assign(id, input, user);
    return reply.send(result);
  }

  async updateExecution(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params;
    const data = updateExecutionSchema.parse(request.body);
    const user = request.user as RequestUser;
    const result = await service.updateExecution(id, data, user);
    return reply.send(result);
  }

  async list(
    request: FastifyRequest<{
      Querystring: {
        status?: string;
        priority?: string;
        teamId?: string;
        technicianId?: string;
        clientId?: string;
        search?: string;
        page?: string;
        limit?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    const { status, priority, teamId, technicianId, clientId, search, page, limit } =
      request.query;
    const user = request.user as RequestUser;
    const result = await service.list({
      companyId: user.companyId,
      status: status as OrderStatus | undefined,
      priority: priority as Priority | undefined,
      teamId,
      technicianId,
      clientId,
      search,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    }, user);
    return reply.send(result);
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const user = request.user as RequestUser;
    const result = await service.delete(request.params.id, user);
    return reply.send(result);
  }

  async findById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const user = request.user as RequestUser;
    const result = await service.findById(request.params.id, user);
    return reply.send(result);
  }
}
