import { FastifyRequest, FastifyReply } from 'fastify';
import { financialService } from './financial.service';
import {
  ListMovementsQuery,
  SummaryQuery,
  type ListMovementsQueryType,
  type SummaryQueryType,
} from './financial.schema';

type AuthUser = { companyId: string };

export const financialController = {
  async listMovements(req: FastifyRequest<{ Querystring: ListMovementsQueryType }>, reply: FastifyReply) {
    const query = ListMovementsQuery.parse(req.query);
    const ctx   = { companyId: (req.user as AuthUser).companyId };
    const result = await financialService.listMovements(query, ctx);
    return reply.status(200).send(result);
  },

  async summary(req: FastifyRequest<{ Querystring: SummaryQueryType }>, reply: FastifyReply) {
    const query = SummaryQuery.parse(req.query);
    const ctx   = { companyId: (req.user as AuthUser).companyId };
    const result = await financialService.summary(query, ctx);
    return reply.status(200).send(result);
  },
};
