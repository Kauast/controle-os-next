import type { FastifyRequest, FastifyReply } from 'fastify';
import { MaterialRequestsService } from './material-requests.service';
import {
  createMaterialRequestSchema,
  reviewMaterialRequestSchema,
  listMaterialRequestsQuerySchema,
} from './material-requests.schema';

const service = new MaterialRequestsService();

export async function listMaterialRequests(req: FastifyRequest, reply: FastifyReply) {
  const { companyId } = req.user as { companyId: string };
  const query = listMaterialRequestsQuerySchema.parse(req.query);
  const result = await service.list(companyId, query);
  return reply.send(result);
}

export async function createMaterialRequest(req: FastifyRequest, reply: FastifyReply) {
  const { companyId } = req.user as { companyId: string };
  const input = createMaterialRequestSchema.parse(req.body);
  const request = await service.create(companyId, input);
  return reply.status(201).send(request);
}

export async function reviewMaterialRequest(req: FastifyRequest, reply: FastifyReply) {
  const { companyId, userId } = req.user as { companyId: string; userId: string };
  const { id } = req.params as { id: string };
  const input = reviewMaterialRequestSchema.parse(req.body);
  const updated = await service.review(companyId, id, userId, input);
  return reply.send(updated);
}
