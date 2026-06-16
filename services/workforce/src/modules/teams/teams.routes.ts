import { FastifyInstance } from 'fastify';
import { TeamController, handleError } from './teams.controller';

const controller = new TeamController();

export async function teamRoutes(app: FastifyInstance) {
  app.setErrorHandler(handleError);

  app.get('/', controller.list.bind(controller));
  app.get('/:id', controller.findById.bind(controller));
  app.post('/', controller.create.bind(controller));
  app.patch('/:id', controller.update.bind(controller));
  app.delete('/:id', controller.delete.bind(controller));

  // Gerenciamento de membros
  app.post('/:id/members', controller.addMember.bind(controller));
  app.delete('/:id/members/:technicianId', controller.removeMember.bind(controller));
}
