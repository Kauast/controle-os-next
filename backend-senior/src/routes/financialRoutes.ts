import { FastifyInstance } from 'fastify';
import { FinancialController } from '../controllers/financialController';
import { authenticate, authorize } from '../middlewares/auth';

const controller = new FinancialController();

export default async function financialRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);
  app.addHook('onRequest', authorize('ADMIN', 'FINANCIAL'));

  app.get('/summary', controller.summary.bind(controller));
  app.get('/invoices', controller.listInvoices.bind(controller));
  app.post('/invoices', controller.createInvoice.bind(controller));
  app.post('/payments', controller.createPayment.bind(controller));
  app.patch<{ Params: { id: string } }>('/payments/:id/confirm', controller.confirmPayment.bind(controller));
  app.patch<{ Params: { id: string } }>('/payments/:id/cancel', controller.cancelPayment.bind(controller));
  app.patch<{ Params: { id: string } }>('/payments/:id/reverse', controller.reversePayment.bind(controller));
}
