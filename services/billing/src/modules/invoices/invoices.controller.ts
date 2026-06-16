import { FastifyRequest, FastifyReply } from 'fastify';
import { invoicesService } from './invoices.service';
import {
  CreateInvoiceBody,
  ListInvoicesQuery,
  InvoiceIdParam,
  type CreateInvoiceBodyType,
  type ListInvoicesQueryType,
  type InvoiceIdParamType,
} from './invoices.schema';

type AuthUser = { companyId: string };

export const invoicesController = {
  async list(req: FastifyRequest<{ Querystring: ListInvoicesQueryType }>, reply: FastifyReply) {
    const query = ListInvoicesQuery.parse(req.query);
    const ctx   = { companyId: (req.user as AuthUser).companyId };
    const result = await invoicesService.list(query, ctx);
    return reply.status(200).send(result);
  },

  async findById(req: FastifyRequest<{ Params: InvoiceIdParamType }>, reply: FastifyReply) {
    const { id } = InvoiceIdParam.parse(req.params);
    const ctx    = { companyId: (req.user as AuthUser).companyId };
    const result = await invoicesService.findById(id, ctx);
    return reply.status(200).send(result);
  },

  async create(req: FastifyRequest<{ Body: CreateInvoiceBodyType }>, reply: FastifyReply) {
    const body = CreateInvoiceBody.parse(req.body);
    const ctx  = { companyId: (req.user as AuthUser).companyId };
    const result = await invoicesService.create(body, ctx);
    return reply.status(201).send(result);
  },

  async issue(req: FastifyRequest<{ Params: InvoiceIdParamType }>, reply: FastifyReply) {
    const { id } = InvoiceIdParam.parse(req.params);
    const ctx    = { companyId: (req.user as AuthUser).companyId };
    const result = await invoicesService.issue(id, ctx);
    return reply.status(200).send(result);
  },

  async cancel(req: FastifyRequest<{ Params: InvoiceIdParamType }>, reply: FastifyReply) {
    const { id } = InvoiceIdParam.parse(req.params);
    const ctx    = { companyId: (req.user as AuthUser).companyId };
    const result = await invoicesService.cancel(id, ctx);
    return reply.status(200).send(result);
  },
};
