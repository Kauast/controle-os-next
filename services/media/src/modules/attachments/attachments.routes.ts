import { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { env } from '../../env';
import {
  uploadAttachment,
  listAttachments,
  getAttachment,
  downloadAttachment,
  deleteAttachment,
} from './attachments.controller';

async function authenticate(request: Parameters<typeof uploadAttachment>[0], reply: Parameters<typeof uploadAttachment>[1]) {
  try {
    await request.jwtVerify();
  } catch (err: unknown) {
    const isExpired = err instanceof Error && err.message.includes('expired');
    return reply.status(401).send({
      error: isExpired ? 'Token expirado' : 'Não autorizado',
      code: isExpired ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED',
    });
  }
}

export default async function attachmentsRoutes(app: FastifyInstance) {
  // Registra o plugin multipart apenas neste escopo
  await app.register(multipart, {
    limits: {
      fileSize: env.MAX_FILE_SIZE,
      files: 1,
    },
  });

  // Todas as rotas deste módulo exigem autenticação
  app.addHook('preHandler', authenticate);

  // POST /attachments — upload de arquivo
  app.post('/', uploadAttachment);

  // GET /attachments?entityType=...&entityId=...
  app.get('/', listAttachments);

  // GET /attachments/:id — metadados
  app.get<{ Params: { id: string } }>('/:id', getAttachment);

  // GET /attachments/:id/download — arquivo (redirect S3 ou stream local)
  app.get<{ Params: { id: string } }>('/:id/download', downloadAttachment);

  // DELETE /attachments/:id — soft delete
  app.delete<{ Params: { id: string } }>('/:id', deleteAttachment);
}
