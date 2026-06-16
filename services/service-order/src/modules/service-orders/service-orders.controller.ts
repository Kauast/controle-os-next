import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { ServiceOrderService, RequestUser } from './service-orders.service';
import {
  createServiceOrderSchema,
  updateStatusSchema,
  assignSchema,
  updateExecutionSchema,
  listQuerySchema,
} from './service-orders.schema';
import { AppError } from '../../lib/errors';

const service = new ServiceOrderService();

function getUser(request: FastifyRequest): RequestUser {
  const user = request.user as { id: string; role: string; companyId: string; name?: string } | undefined;
  if (!user) throw new AppError('Não autorizado', 401, 'UNAUTHORIZED');
  return {
    id:        user.id,
    role:      user.role,
    companyId: user.companyId,
    name:      user.name ?? 'Sistema',
  };
}

export class ServiceOrderController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const user = getUser(request);
    const query = listQuerySchema.parse(request.query);
    const result = await service.list({ ...query, companyId: user.companyId }, user);
    return reply.send(result);
  }

  async findById(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = getUser(request);
    const result = await service.findById(request.params.id, user);
    return reply.send(result);
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const user = getUser(request);
    const body = createServiceOrderSchema.parse(request.body);
    const result = await service.create(body, user);
    return reply.status(201).send(result);
  }

  async assign(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = getUser(request);
    const body = assignSchema.parse(request.body);
    const result = await service.assign(request.params.id, body, user);
    return reply.send(result);
  }

  async updateStatus(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = getUser(request);
    const body = updateStatusSchema.parse(request.body);
    const result = await service.updateStatus(request.params.id, body, user);
    return reply.send(result);
  }

  async updateExecution(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = getUser(request);
    const body = updateExecutionSchema.parse(request.body);
    const result = await service.updateExecution(request.params.id, body, user);
    return reply.send(result);
  }

  async delete(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = getUser(request);
    const result = await service.delete(request.params.id, user);
    return reply.send(result);
  }

  async getHistory(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = getUser(request);
    const result = await service.getHistory(request.params.id, user);
    return reply.send(result);
  }

  async getEvents(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = getUser(request);
    const result = await service.getEvents(request.params.id, user);
    return reply.send(result);
  }
}
