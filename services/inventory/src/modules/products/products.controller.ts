import type { FastifyRequest, FastifyReply } from 'fastify';
import { ProductsService } from './products.service';
import { createProductSchema, updateProductSchema, listProductsQuerySchema } from './products.schema';

const service = new ProductsService();

export async function listProducts(req: FastifyRequest, reply: FastifyReply) {
  const { companyId } = req.user as { companyId: string };
  const query = listProductsQuerySchema.parse(req.query);
  const result = await service.list(companyId, query);
  return reply.send(result);
}

export async function getProduct(req: FastifyRequest, reply: FastifyReply) {
  const { companyId } = req.user as { companyId: string };
  const { id } = req.params as { id: string };
  const product = await service.findById(companyId, id);
  return reply.send(product);
}

export async function createProduct(req: FastifyRequest, reply: FastifyReply) {
  const { companyId } = req.user as { companyId: string };
  const input = createProductSchema.parse({ ...(req.body as object), companyId });
  const product = await service.create(input);
  return reply.status(201).send(product);
}

export async function updateProduct(req: FastifyRequest, reply: FastifyReply) {
  const { companyId } = req.user as { companyId: string };
  const { id } = req.params as { id: string };
  const input = updateProductSchema.parse(req.body);
  const product = await service.update(companyId, id, input);
  return reply.send(product);
}

export async function deleteProduct(req: FastifyRequest, reply: FastifyReply) {
  const { companyId } = req.user as { companyId: string };
  const { id } = req.params as { id: string };
  await service.softDelete(companyId, id);
  return reply.status(204).send();
}
