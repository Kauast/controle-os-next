import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ServiceOrderController } from './service-orders.controller';

const controller = new ServiceOrderController();

async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err: unknown) {
    const isExpired = err instanceof Error && err.message.includes('expired');
    return reply.status(401).send({
      error: isExpired ? 'Token expirado' : 'Não autorizado',
      code:  isExpired ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED',
    });
  }
}

function authorize(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { role: string } | undefined;
    if (!user || !roles.includes(user.role)) {
      return reply.status(403).send({ error: 'Acesso negado', code: 'FORBIDDEN' });
    }
  };
}

export default async function serviceOrderRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  // GET /service-orders — lista paginada
  app.get('/', controller.list.bind(controller));

  // GET /service-orders/:id
  app.get<{ Params: { id: string } }>('/:id', controller.findById.bind(controller));

  // POST /service-orders — dispara Saga de Criação
  app.post(
    '/',
    { onRequest: [authorize('ADMIN', 'ATTENDANT')] },
    controller.create.bind(controller),
  );

  // PATCH /service-orders/:id/assign — atribui técnico (OPEN → ASSIGNED)
  app.patch<{ Params: { id: string } }>(
    '/:id/assign',
    { onRequest: [authorize('ADMIN', 'ATTENDANT')] },
    controller.assign.bind(controller),
  );

  // PATCH /service-orders/:id/status — transição de estado
  app.patch<{ Params: { id: string } }>(
    '/:id/status',
    { onRequest: [authorize('ADMIN', 'ATTENDANT', 'TECHNICIAN')] },
    controller.updateStatus.bind(controller),
  );

  // PATCH /service-orders/:id/execution — check-in/check-out/GPS/assinatura
  app.patch<{ Params: { id: string } }>(
    '/:id/execution',
    { onRequest: [authorize('ADMIN', 'ATTENDANT', 'TECHNICIAN')] },
    controller.updateExecution.bind(controller),
  );

  // DELETE /service-orders/:id — soft delete
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { onRequest: [authorize('ADMIN', 'ATTENDANT')] },
    controller.delete.bind(controller),
  );

  // GET /service-orders/:id/history
  app.get<{ Params: { id: string } }>('/:id/history', controller.getHistory.bind(controller));

  // GET /service-orders/:id/events
  app.get<{ Params: { id: string } }>('/:id/events', controller.getEvents.bind(controller));
}
