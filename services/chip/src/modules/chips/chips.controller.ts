import { FastifyRequest, FastifyReply } from 'fastify';
import { ChipService, RequestUser } from './chips.service';
import {
  createChipSchema,
  updateChipSchema,
  assignChipSchema,
  installChipSchema,
  listChipsQuerySchema,
} from './chips.schema';
import { AppError } from '../../lib/errors';

const chipService = new ChipService();

function extractUser(request: FastifyRequest): RequestUser {
  const jwt = request.user as { sub: string; companyId: string; name?: string; role?: string };
  return {
    id: jwt.sub,
    companyId: jwt.companyId,
    name: jwt.name,
    role: jwt.role,
  };
}

function sendError(reply: FastifyReply, err: unknown) {
  if (err instanceof AppError) {
    return reply.status(err.statusCode).send({
      error: err.code ?? 'ERROR',
      message: err.message,
    });
  }
  return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Erro interno do servidor' });
}

// GET /chips
export async function listChips(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = extractUser(request);
    const query = listChipsQuerySchema.parse(request.query);
    const result = await chipService.list(query, user.companyId);
    return reply.send(result);
  } catch (err) {
    return sendError(reply, err);
  }
}

// GET /chips/:id
export async function getChip(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const user = extractUser(request);
    const chip = await chipService.findById(request.params.id, user.companyId);
    return reply.send(chip);
  } catch (err) {
    return sendError(reply, err);
  }
}

// GET /chips/:id/history
export async function getChipHistory(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const user = extractUser(request);
    const history = await chipService.findHistory(request.params.id, user.companyId);
    return reply.send({ data: history });
  } catch (err) {
    return sendError(reply, err);
  }
}

// POST /chips
export async function createChip(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = extractUser(request);
    const data = createChipSchema.parse(request.body);
    const chip = await chipService.create(data, user);
    return reply.status(201).send(chip);
  } catch (err) {
    return sendError(reply, err);
  }
}

// PATCH /chips/:id
export async function updateChip(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const user = extractUser(request);
    const data = updateChipSchema.parse(request.body);
    const chip = await chipService.update(request.params.id, data, user);
    return reply.send(chip);
  } catch (err) {
    return sendError(reply, err);
  }
}

// DELETE /chips/:id
export async function deleteChip(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const user = extractUser(request);
    await chipService.delete(request.params.id, user);
    return reply.status(204).send();
  } catch (err) {
    return sendError(reply, err);
  }
}

// POST /chips/:id/assign
export async function assignChip(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const user = extractUser(request);
    const data = assignChipSchema.parse(request.body);
    const chip = await chipService.assign(request.params.id, data, user);
    return reply.send(chip);
  } catch (err) {
    return sendError(reply, err);
  }
}

// POST /chips/:id/install
export async function installChip(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const user = extractUser(request);
    const data = installChipSchema.parse(request.body);
    const chip = await chipService.install(request.params.id, data, user);
    return reply.send(chip);
  } catch (err) {
    return sendError(reply, err);
  }
}

// POST /chips/:id/release
export async function releaseChip(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const user = extractUser(request);
    const chip = await chipService.release(request.params.id, user);
    return reply.send(chip);
  } catch (err) {
    return sendError(reply, err);
  }
}
