import { FastifyRequest, FastifyReply } from 'fastify';
import { AiService, triageInputSchema } from '../services/aiService';

const service = new AiService();

export class AiController {
  async triage(request: FastifyRequest, reply: FastifyReply) {
    const data = triageInputSchema.parse(request.body);
    const result = await service.triageServiceOrder(data);
    return reply.send(result);
  }
}
