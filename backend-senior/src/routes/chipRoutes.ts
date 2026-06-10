import { FastifyInstance } from 'fastify';
import { ChipStatus } from '@prisma/client';
import { authenticate } from '../middlewares/auth';
import { ChipService, createChipSchema, updateChipSchema } from '../services/chipService';

const chipService = new ChipService();

export default async function chipRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  // GET /api/chips
  app.get('/', async (req, reply) => {
    const { clientId, status, page, limit } = req.query as {
      clientId?: string;
      status?: ChipStatus;
      page?: string;
      limit?: string;
    };
    const result = await chipService.list({
      clientId,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return reply.send(result);
  });

  // GET /api/chips/:id
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const chip = await chipService.findById(id);
    return reply.send(chip);
  });

  // POST /api/chips
  app.post('/', async (req, reply) => {
    const data = createChipSchema.parse(req.body);
    const chip = await chipService.create(data);
    return reply.status(201).send(chip);
  });

  // PUT /api/chips/:id
  app.put('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = updateChipSchema.parse(req.body);
    const chip = await chipService.update(id, data);
    return reply.send(chip);
  });

  // PATCH /api/chips/:id/transfer
  app.patch('/:id/transfer', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { clientId } = req.body as { clientId: string | null };
    const chip = await chipService.transfer(id, clientId ?? null);
    return reply.send(chip);
  });

  // DELETE /api/chips/:id
  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await chipService.delete(id);
    return reply.status(204).send();
  });
}
