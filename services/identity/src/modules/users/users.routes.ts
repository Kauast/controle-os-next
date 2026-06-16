import { FastifyInstance } from 'fastify';
import { UsersController } from './users.controller';
import { authenticate, authorize } from '../../plugins/jwt.plugin';

const controller = new UsersController();

export default async function usersRoutes(app: FastifyInstance) {
  // Todos os endpoints requerem autenticacao + role ADMIN
  app.addHook('onRequest', authenticate);
  app.addHook('onRequest', authorize('ADMIN'));

  app.get('/', controller.list.bind(controller));
  app.post('/', controller.create.bind(controller));
  app.patch<{ Params: { id: string } }>('/:id', controller.update.bind(controller));
  app.delete<{ Params: { id: string } }>('/:id', controller.remove.bind(controller));
  app.patch<{ Params: { id: string } }>('/:id/password', controller.resetPassword.bind(controller));
}
