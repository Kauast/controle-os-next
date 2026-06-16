import type { FastifyInstance } from 'fastify';
import { handleListNotifications } from './notifications.controller';

export default async function notificationRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /notifications
   * Historico de notificacoes da company autenticada.
   * Query params: channel (EMAIL|SMS|PUSH), status (PENDING|SENT|FAILED), page, limit
   */
  app.get('/', handleListNotifications);
}
