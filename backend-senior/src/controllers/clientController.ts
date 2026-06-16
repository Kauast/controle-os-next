import { FastifyRequest, FastifyReply } from 'fastify';
import { ClientService, createClientSchema, updateClientSchema } from '../modules/client/client.service';

const service = new ClientService();

interface RequestUser {
  id: string;
  companyId: string;
}

export class ClientController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = createClientSchema.parse(request.body);
    const user = request.user as RequestUser;
    const result = await service.create(data, user);
    return reply.status(201).send(result);
  }

  async list(
    request: FastifyRequest<{ Querystring: { page?: string; limit?: string; search?: string; isBlocked?: string } }>,
    reply: FastifyReply
  ) {
    const { page, limit, search, isBlocked } = request.query;
    const user = request.user as RequestUser;
    return reply.send(
      await service.list({
        companyId: user.companyId,
        page: page ? +page : 1,
        limit: limit ? +limit : 10,
        search,
        isBlocked: isBlocked !== undefined ? isBlocked === 'true' : undefined,
      })
    );
  }

  async findById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const user = request.user as RequestUser;
    return reply.send(await service.findById(request.params.id, user.companyId));
  }

  async update(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const data = updateClientSchema.parse(request.body);
    const user = request.user as RequestUser;
    return reply.send(await service.update(request.params.id, data, user));
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const user = request.user as RequestUser;
    await service.delete(request.params.id, user);
    return reply.status(204).send();
  }

  async toggleBlock(
    request: FastifyRequest<{ Params: { id: string }; Body: { blocked: boolean; reason?: string } }>,
    reply: FastifyReply
  ) {
    const { blocked, reason } = request.body;
    const user = request.user as RequestUser;
    return reply.send(await service.toggleBlock(request.params.id, blocked, reason, user));
  }
}
