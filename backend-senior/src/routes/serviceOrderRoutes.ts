import { FastifyInstance } from 'fastify';
import { ServiceOrderController } from '../controllers/serviceOrderController';
import { authenticate, authorize } from '../middlewares/auth';

const controller = new ServiceOrderController();

export default async function serviceOrderRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.get<{
    Querystring: { status?: string; priority?: string; team?: string; technicianId?: string; page?: string; limit?: string };
  }>('/', controller.list.bind(controller));

  app.get<{ Params: { id: string } }>('/:id', controller.findById.bind(controller));

  app.post('/', { onRequest: authorize('ADMIN', 'ATTENDANT') }, controller.create.bind(controller));

  app.patch<{ Params: { id: string }; Body: { status: string; cancellationReason?: string } }>(
    '/:id/status',
    { onRequest: authorize('ADMIN', 'ATTENDANT', 'TECHNICIAN') },
    controller.updateStatus.bind(controller)
  );

  app.patch<{ Params: { id: string }; Body: { team: string; technicianId?: string | null } }>(
    '/:id/assign',
    { onRequest: authorize('ADMIN', 'ATTENDANT') },
    controller.assign.bind(controller)
  );

  app.patch<{ Params: { id: string } }>(
    '/:id/execution',
    { onRequest: authorize('ADMIN', 'ATTENDANT', 'TECHNICIAN') },
    controller.updateExecution.bind(controller)
  );

  app.delete<{ Params: { id: string } }>(
    "/:id",
    { onRequest: authorize("ADMIN", "ATTENDANT") },
    controller.delete.bind(controller)
  );
}
