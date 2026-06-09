import { FastifyRequest, FastifyReply } from 'fastify';
import { ClientService, createClientSchema, updateClientSchema, ImportClientInput } from '../services/clientService';

const service = new ClientService();

export class ClientController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = createClientSchema.parse(request.body);
    const result = await service.create(data);
    return reply.status(201).send(result);
  }

  async importBatch(request: FastifyRequest, reply: FastifyReply) {
    const { items } = request.body as { items: ImportClientInput[] };
    if (!Array.isArray(items) || items.length === 0) {
      return reply.status(400).send({ error: 'items deve ser um array não vazio' });
    }
    if (items.length > 2000) {
      return reply.status(400).send({ error: 'Máximo de 2000 clientes por importação' });
    }
    const result = await service.importBatch(items);
    return reply.send(result);
  }

  async list(
    request: FastifyRequest<{ Querystring: { page?: string; limit?: string; search?: string } }>,
    reply: FastifyReply
  ) {
    const { page, limit, search } = request.query;
    return reply.send(
      await service.list({ page: page ? +page : 1, limit: limit ? +limit : 10, search })
    );
  }

  async findById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    return reply.send(await service.findById(request.params.id));
  }

  async update(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const data = updateClientSchema.parse(request.body);
    return reply.send(await service.update(request.params.id, data));
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    await service.delete(request.params.id);
    return reply.status(204).send();
  }
}
