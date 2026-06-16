import { FastifyRequest, FastifyReply } from 'fastify';
import { AttachmentsService } from './attachments.service';
import {
  listAttachmentsQuerySchema,
  attachmentParamsSchema,
  uploadFieldsSchema,
} from './attachments.schema';

const service = new AttachmentsService();

interface RequestUser {
  id: string;
  companyId: string;
  role: string;
}

// ---------------------------------------------------------------------------
// POST /attachments
// ---------------------------------------------------------------------------

export async function uploadAttachment(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const user = request.user as RequestUser;

  const data = await request.file();
  if (!data) {
    return reply.status(400).send({ error: 'Nenhum arquivo enviado', code: 'NO_FILE' });
  }

  // Lê buffer antes de consumir os fields
  const buffer = await data.toBuffer();

  // Extrai campos extras do form-data
  const rawFields = {
    entityType: (data.fields?.entityType as { value?: string })?.value ?? '',
    entityId: (data.fields?.entityId as { value?: string })?.value ?? '',
  };

  const fieldsResult = uploadFieldsSchema.safeParse(rawFields);
  if (!fieldsResult.success) {
    return reply.status(400).send({
      error: 'Campos obrigatórios ausentes: entityType e entityId',
      details: fieldsResult.error.issues,
      code: 'VALIDATION_ERROR',
    });
  }

  const attachment = await service.upload(
    {
      buffer,
      mimeType: data.mimetype,
      originalName: data.filename ?? 'upload',
      entityType: fieldsResult.data.entityType,
      entityId: fieldsResult.data.entityId,
    },
    user,
  );

  return reply.status(201).send({
    id: attachment.id,
    companyId: attachment.companyId,
    entityType: attachment.entityType,
    entityId: attachment.entityId,
    filename: attachment.filename,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    url: attachment.url,
    hash: attachment.hash,
    uploadedBy: attachment.uploadedBy,
    createdAt: attachment.createdAt,
  });
}

// ---------------------------------------------------------------------------
// GET /attachments
// ---------------------------------------------------------------------------

export async function listAttachments(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const user = request.user as RequestUser;

  const queryResult = listAttachmentsQuerySchema.safeParse(request.query);
  if (!queryResult.success) {
    return reply.status(400).send({
      error: 'Parâmetros inválidos',
      details: queryResult.error.issues,
      code: 'VALIDATION_ERROR',
    });
  }

  const result = await service.list(queryResult.data, user.companyId);
  return reply.send(result);
}

// ---------------------------------------------------------------------------
// GET /attachments/:id
// ---------------------------------------------------------------------------

export async function getAttachment(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const user = request.user as RequestUser;
  const paramsResult = attachmentParamsSchema.safeParse(request.params);
  if (!paramsResult.success) {
    return reply.status(400).send({ error: 'ID inválido', code: 'VALIDATION_ERROR' });
  }

  const attachment = await service.findById(paramsResult.data.id, user.companyId);
  return reply.send({
    id: attachment.id,
    companyId: attachment.companyId,
    entityType: attachment.entityType,
    entityId: attachment.entityId,
    filename: attachment.filename,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    url: attachment.url,
    hash: attachment.hash,
    uploadedBy: attachment.uploadedBy,
    createdAt: attachment.createdAt,
  });
}

// ---------------------------------------------------------------------------
// GET /attachments/:id/download
// ---------------------------------------------------------------------------

export async function downloadAttachment(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const user = request.user as RequestUser;
  const paramsResult = attachmentParamsSchema.safeParse(request.params);
  if (!paramsResult.success) {
    return reply.status(400).send({ error: 'ID inválido', code: 'VALIDATION_ERROR' });
  }

  const result = await service.getDownloadUrl(paramsResult.data.id, user.companyId);

  if (result.redirect) {
    return reply.status(302).redirect(result.url);
  }

  reply.header('Content-Type', result.mimeType);
  reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(result.originalName)}"`);
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('Cache-Control', 'private, no-store');
  return reply.send(result.buffer);
}

// ---------------------------------------------------------------------------
// DELETE /attachments/:id
// ---------------------------------------------------------------------------

export async function deleteAttachment(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const user = request.user as RequestUser;
  const paramsResult = attachmentParamsSchema.safeParse(request.params);
  if (!paramsResult.success) {
    return reply.status(400).send({ error: 'ID inválido', code: 'VALIDATION_ERROR' });
  }

  const result = await service.softDelete(paramsResult.data.id, user);
  return reply.send(result);
}
