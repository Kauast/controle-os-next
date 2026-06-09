import { FastifyInstance } from 'fastify';
import { ReportController } from '../controllers/reportController';
import { authenticate } from '../middlewares/auth';

const controller = new ReportController();

export default async function reportRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.get('/team', controller.teamReport.bind(controller));
  app.get('/finance', controller.financeSummary.bind(controller));
}
