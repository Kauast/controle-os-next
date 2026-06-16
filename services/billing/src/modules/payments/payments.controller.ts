import { FastifyRequest, FastifyReply } from 'fastify';
import { paymentsService } from './payments.service';
import {
  CreatePaymentBody,
  ListPaymentsQuery,
  PaymentIdParam,
  type CreatePaymentBodyType,
  type ListPaymentsQueryType,
  type PaymentIdParamType,
} from './payments.schema';

type AuthUser = { companyId: string };

export const paymentsController = {
  async list(req: FastifyRequest<{ Querystring: ListPaymentsQueryType }>, reply: FastifyReply) {
    const query = ListPaymentsQuery.parse(req.query);
    const ctx   = { companyId: (req.user as AuthUser).companyId };
    const result = await paymentsService.list(query, ctx);
    return reply.status(200).send(result);
  },

  async create(req: FastifyRequest<{ Body: CreatePaymentBodyType }>, reply: FastifyReply) {
    const body = CreatePaymentBody.parse(req.body);
    const ctx  = { companyId: (req.user as AuthUser).companyId };
    const result = await paymentsService.create(body, ctx);
    return reply.status(201).send(result);
  },

  async cancel(req: FastifyRequest<{ Params: PaymentIdParamType }>, reply: FastifyReply) {
    const { id } = PaymentIdParam.parse(req.params);
    const ctx    = { companyId: (req.user as AuthUser).companyId };
    const result = await paymentsService.cancel(id, ctx);
    return reply.status(200).send(result);
  },
};
