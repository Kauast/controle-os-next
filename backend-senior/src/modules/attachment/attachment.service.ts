import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { audit } from '../audit/audit.service';
import { NotFoundError, ForbiddenError } from '../../shared/errors';
import { parsePagination, buildPaginatedResult } from '../../shared/pagination';

export const createAttachmentSchema = z.object({
  entityType: z.string().min(1).max(50),
  entityId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  originalName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  fileSize: z.number().int().positive(),
  storageProvider: z.enum(['local', 's3', 'gcs']).default('local'),
  storagePath: z.string().min(1),
  hash: z.string().optional(),
  serviceOrderId: z.string().cuid().optional(),
});

export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>;

interface RequestUser {
  id: string;
  companyId: string;
}

export class AttachmentService {
  async create(data: CreateAttachmentInput, user: RequestUser) {
    const attachment = await prisma.attachment.create({
      data: {
        companyId: user.companyId,
        entityType: data.entityType,
        entityId: data.entityId,
        serviceOrderId: data.serviceOrderId,
        fileName: data.fileName,
        originalName: data.originalName,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        storageProvider: data.storageProvider,
        storagePath: data.storagePath,
        hash: data.hash,
        uploadedBy: user.id,
      },
    });

    await audit({
      companyId: user.companyId,
      userId: user.id,
      entity: 'Attachment',
      entityId: attachment.id,
      action: 'ATTACHMENT_CREATED',
      after: {
        entityType: data.entityType,
        entityId: data.entityId,
        fileName: data.fileName,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
      },
    });

    return attachment;
  }

  async listByEntity(params: {
    companyId: string;
    entityType: string;
    entityId: string;
    page?: number;
    limit?: number;
  }) {
    const { page, limit, skip } = parsePagination(params);

    const where = {
      companyId: params.companyId,
      entityType: params.entityType,
      entityId: params.entityId,
      deletedAt: null,
    };

    const [data, total] = await Promise.all([
      prisma.attachment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.attachment.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findById(id: string, companyId: string) {
    const attachment = await prisma.attachment.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!attachment) throw new NotFoundError('Anexo');
    return attachment;
  }

  // Soft delete — mantém rastreabilidade do arquivo mesmo após remoção
  async softDelete(id: string, user: RequestUser) {
    const attachment = await prisma.attachment.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
    });
    if (!attachment) throw new NotFoundError('Anexo');

    // Apenas quem fez o upload ou admin pode deletar
    if (attachment.uploadedBy && attachment.uploadedBy !== user.id) {
      throw new ForbiddenError('Sem permissão para excluir este anexo');
    }

    const updated = await prisma.attachment.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: user.id,
      },
    });

    await audit({
      companyId: user.companyId,
      userId: user.id,
      entity: 'Attachment',
      entityId: id,
      action: 'ATTACHMENT_DELETED',
      before: { fileName: attachment.fileName, entityType: attachment.entityType, entityId: attachment.entityId },
    });

    return updated;
  }
}
