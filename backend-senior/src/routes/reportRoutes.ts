import { FastifyInstance } from 'fastify';
import { ReportController } from '../controllers/reportController';
import { authenticate, authorize } from '../middlewares/auth';

const controller = new ReportController();

export default async function reportRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.get<{ Querystring: { team?: string } }>(
    '/team',
    { onRequest: authorize('ADMIN', 'FINANCIAL') },
    controller.teamReport.bind(controller)
  );
  app.get(
    '/finance',
    { onRequest: authorize('ADMIN', 'FINANCIAL') },
    controller.financeSummary.bind(controller)
  );
  app.get('/locations', controller.teamLocations.bind(controller));
  app.get(
    '/attendants',
    { onRequest: authorize('ADMIN', 'FINANCIAL') },
    controller.attendantReport.bind(controller)
  );
  app.get(
    '/users',
    { onRequest: authorize('ADMIN') },
    controller.listUsers.bind(controller)
  );
}
