import { FastifyRequest, FastifyReply } from 'fastify';
import { SyncService, syncBatchSchema } from '../modules/sync/sync.service';

const service = new SyncService();

interface RequestUser {
  id: string;
  role: string;
  companyId: string;
}

export class SyncController {
  async batch(request: FastifyRequest, reply: FastifyReply) {
    const { actions } = syncBatchSchema.parse(request.body);
    const user = request.user as RequestUser;
    const results = await service.processBatch(actions, user);
    return reply.send({ results });
  }
}
