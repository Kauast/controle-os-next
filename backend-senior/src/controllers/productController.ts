import { FastifyRequest, FastifyReply } from 'fastify';
import { ProductService, createProductSchema } from '../modules/product/product.service';
import { StockService } from '../modules/stock/stock.service';

const service = new ProductService();
const stockService = new StockService();

interface RequestUser {
  id: string;
  companyId: string;
}

export class ProductController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = createProductSchema.parse(request.body);
    const user = request.user as RequestUser;
    return reply.status(201).send(await service.create(data, user));
  }

  async list(
    request: FastifyRequest<{
      Querystring: { page?: string; limit?: string; search?: string; categoryId?: string; lowStock?: string };
    }>,
    reply: FastifyReply
  ) {
    const { page, limit, search, categoryId, lowStock } = request.query;
    const user = request.user as RequestUser;
    return reply.send(
      await service.list({
        companyId: user.companyId,
        page: page ? +page : 1,
        limit: limit ? +limit : 10,
        search,
        categoryId,
        lowStock: lowStock === 'true',
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

  async adjustStock(
    request: FastifyRequest<{ Params: { id: string }; Body: { quantity: number; reason: string } }>,
    reply: FastifyReply
  ) {
    const { quantity, reason } = request.body;
    const user = request.user as RequestUser;
    const type = quantity >= 0 ? 'ADJUSTMENT' : 'OUT';
    return reply.send(
      await stockService.adjustStock({
        companyId: user.companyId,
        productId: request.params.id,
        type: type as 'ADJUSTMENT' | 'OUT',
        quantity: Math.abs(quantity),
        reason,
        userId: user.id,
      })
    );
  }

  async lowStock(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as RequestUser;
    return reply.send(await service.list({ companyId: user.companyId, lowStock: true, limit: 200 }));
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const user = request.user as RequestUser;
    return reply.send(await service.delete(request.params.id, user));
  }
}
