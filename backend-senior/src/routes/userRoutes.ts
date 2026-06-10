import { FastifyInstance } from 'fastify';
import { UserController } from '../controllers/userController';
import { authenticate, authorize } from '../middlewares/auth';

const controller = new UserController();

export default async function userRoutes(app: FastifyInstance) {
  // Todos os endpoints exigem autenticação + role ADMIN
  app.addHook('onRequest', authenticate);
  app.addHook('onRequest', authorize('ADMIN'));

  app.get('/', controller.list.bind(controller));
  app.post('/', controller.create.bind(controller));
  app.patch<{ Params: { id: string } }>('/:id', controller.update.bind(controller));
  app.patch<{ Params: { id: string } }>(
    '/:id/password',
    controller.resetPassword.bind(controller),
  );
  app.delete<{ Params: { id: string } }>('/:id', controller.remove.bind(controller));
}
