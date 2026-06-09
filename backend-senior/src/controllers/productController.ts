import { FastifyRequest, FastifyReply } from 'fastify';
import { ProductService, createProductSchema, adjustStockSchema } from '../services/productService';

const service = new ProductService();

export class ProductController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = createProductSchema.parse(request.body);
    return reply.status(201).send(await service.create(data));
  }

  async list(
    request: FastifyRequest<{ Querystring: { page?: string; limit?: string; search?: string } }>,
    reply: FastifyReply
  ) {
    const { page, limit, search } = request.query;
    return reply.send(await service.list({ page: page ? +page : 1, limit: limit ? +limit : 10, search }));
  }

  async adjustStock(
    request: FastifyRequest<{ Params: { id: string }; Body: { quantity: number; reason: string } }>,
    reply: FastifyReply
  ) {
    const { quantity, reason } = adjustStockSchema.parse(request.body);
    return reply.send(await service.adjustStock(request.params.id, quantity, reason));
  }

  async lowStock(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await service.lowStock());
  }
}
