import { FastifyInstance } from 'fastify';
import { TechnicianController, handleError } from './technicians.controller';

const controller = new TechnicianController();

export async function technicianRoutes(app: FastifyInstance) {
  app.setErrorHandler(handleError);

  // Listar técnicos — filtros: status, isActive
  app.get('/', controller.list.bind(controller));

  // Buscar técnico por ID
  app.get('/:id', controller.findById.bind(controller));

  // Consulta de capacidade — usada pelo Service Order Svc via REST síncrono
  app.get('/:id/capacity', controller.getCapacity.bind(controller));

  // Criar técnico
  app.post('/', controller.create.bind(controller));

  // Atualizar dados do técnico
  app.patch('/:id', controller.update.bind(controller));

  // Atualizar status; publica technician.status_changed
  app.patch('/:id/status', controller.updateStatus.bind(controller));

  // Soft delete; publica technician.deactivated
  app.delete('/:id', controller.delete.bind(controller));
}
