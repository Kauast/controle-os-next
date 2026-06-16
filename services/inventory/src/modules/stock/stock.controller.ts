import type { FastifyRequest, FastifyReply } from 'fastify';
import { StockService } from './stock.service';
import {
  createMovementSchema,
  createReservationSchema,
  listMovementsQuerySchema,
} from './stock.schema';

const service = new StockService();

export async function getBalance(req: FastifyRequest, reply: FastifyReply) {
  const { companyId } = req.user as { companyId: string };
  const { id } = req.params as { id: string };
  const balance = await service.getBalance(companyId, id);
  return reply.send(balance);
}

export async function createMovement(req: FastifyRequest, reply: FastifyReply) {
  const { companyId, userId, name } = req.user as { companyId: string; userId: string; name: string };
  const input = createMovementSchema.parse(req.body);
  const movement = await service.createMovement(companyId, userId, name ?? 'system', input);
  return reply.status(201).send(movement);
}

export async function createReservation(req: FastifyRequest, reply: FastifyReply) {
  const { companyId, userId } = req.user as { companyId: string; userId: string };
  const input = createReservationSchema.parse(req.body);
  const result = await service.createReservation(companyId, userId, input);
  return reply.status(201).send(result);
}

export async function consumeReservation(req: FastifyRequest, reply: FastifyReply) {
  const { companyId, userId, name } = req.user as { companyId: string; userId: string; name: string };
  const { id } = req.params as { id: string };
  await service.consumeReservation(companyId, id, userId, name ?? 'system');
  return reply.status(204).send();
}

export async function releaseReservation(req: FastifyRequest, reply: FastifyReply) {
  const { companyId, userId } = req.user as { companyId: string; userId: string };
  const { id } = req.params as { id: string };
  await service.releaseReservation(companyId, id, userId);
  return reply.status(204).send();
}

export async function listMovements(req: FastifyRequest, reply: FastifyReply) {
  const { companyId } = req.user as { companyId: string };
  const query = listMovementsQuerySchema.parse(req.query);
  const result = await service.listMovements(companyId, query);
  return reply.send(result);
}
