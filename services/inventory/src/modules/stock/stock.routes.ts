import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middlewares/auth';
import {
  getBalance,
  createMovement,
  createReservation,
  consumeReservation,
  releaseReservation,
  listMovements,
} from './stock.controller';

export default async function stockRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  // Saldo de um produto especifico
  app.get('/products/:id/balance', getBalance);

  // Movimentacoes manuais
  app.get('/stock/movements', listMovements);
  app.post('/stock/movements', createMovement);

  // Reservas
  app.post('/stock/reservations', createReservation);
  app.post('/stock/reservations/:id/consume', consumeReservation);
  app.post('/stock/reservations/:id/release', releaseReservation);
}
