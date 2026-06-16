import type { FastifyRequest, FastifyReply } from 'fastify';
import { listNotificationsQuerySchema } from './notifications.schema';
import { listNotifications } from './notifications.service';

// Extrai companyId de um header interno passado pelo API gateway / monólito.
// Em produção o gateway deve validar o JWT e injetar o header antes de
// encaminhar a requisição para este serviço.
function getCompanyId(req: FastifyRequest): string {
  const companyId = req.headers['x-company-id'] as string | undefined;
  if (!companyId) throw Object.assign(new Error('x-company-id header obrigatorio'), { statusCode: 401 });
  return companyId;
}

export async function handleListNotifications(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const companyId = getCompanyId(req);
  const query     = listNotificationsQuerySchema.parse(req.query);
  const result    = await listNotifications(companyId, query);
  await reply.status(200).send(result);
}
