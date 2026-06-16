import { FastifyRequest, FastifyReply } from 'fastify';
import { ClientsService } from './clients.service';
import {
  createClientSchema,
  updateClientSchema,
  blockClientSchema,
  listClientsQuerySchema,
} from './clients.schema';
import { AppError } from '../../lib/errors';

const service = new ClientsService();

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    sub: string;
    companyId: string;
    role: string;
  };
}

export async function listClients(req: FastifyRequest, reply: FastifyReply) {
  const user = (req as AuthenticatedRequest).user;
  const query = listClientsQuerySchema.parse(req.query);
  const result = await service.list(query, user.companyId);
  return reply.send(result);
}

export async function getClient(req: FastifyRequest, reply: FastifyReply) {
  const user = (req as AuthenticatedRequest).user;
  const { id } = req.params as { id: string };
  const client = await service.findById(id, user.companyId);
  return reply.send(client);
}

export async function createClient(req: FastifyRequest, reply: FastifyReply) {
  const user = (req as AuthenticatedRequest).user;
  const data = createClientSchema.parse(req.body);
  const client = await service.create(data, {
    id: user.sub,
    companyId: user.companyId,
    role: user.role,
  });
  return reply.status(201).send(client);
}

export async function updateClient(req: FastifyRequest, reply: FastifyReply) {
  const user = (req as AuthenticatedRequest).user;
  const { id } = req.params as { id: string };
  const data = updateClientSchema.parse(req.body);
  const client = await service.update(id, data, {
    id: user.sub,
    companyId: user.companyId,
    role: user.role,
  });
  return reply.send(client);
}

export async function deleteClient(req: FastifyRequest, reply: FastifyReply) {
  const user = (req as AuthenticatedRequest).user;
  const { id } = req.params as { id: string };
  const result = await service.softDelete(id, {
    id: user.sub,
    companyId: user.companyId,
    role: user.role,
  });
  return reply.send(result);
}

export async function blockClient(req: FastifyRequest, reply: FastifyReply) {
  const user = (req as AuthenticatedRequest).user;
  const { id } = req.params as { id: string };
  const data = blockClientSchema.parse(req.body);
  const client = await service.block(id, data, {
    id: user.sub,
    companyId: user.companyId,
    role: user.role,
  });
  return reply.send(client);
}

export async function unblockClient(req: FastifyRequest, reply: FastifyReply) {
  const user = (req as AuthenticatedRequest).user;
  const { id } = req.params as { id: string };
  const client = await service.unblock(id, {
    id: user.sub,
    companyId: user.companyId,
    role: user.role,
  });
  return reply.send(client);
}
