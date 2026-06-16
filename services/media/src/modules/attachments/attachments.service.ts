import { createHash, randomUUID } from 'crypto';
import { extname } from 'path';
import { prisma } from '../../lib/prisma';
import { getStorageProvider, S3StorageProvider } from '../../lib/storage';
import { publish } from '../../lib/publisher';
import { uploadBytesTotal, uploadTotal, storageOperationDuration } from '../../lib/metrics';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { parsePagination, buildPaginatedResult } from '../../lib/pagination';
import { env } from '../../env';
import type { ListAttachmentsQuery } from './attachments.schema';

const ALLOWED_MIME_TYPES = new Set(
  env.ALLOWED_MIME_TYPES.split(',').map((m) => m.trim()),
);

const MAX_FILE_SIZE = env.MAX_FILE_SIZE;

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

export interface RequestUser {
  id: string;
  companyId: string;
  role: string;
}

export interface UploadInput {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  entityType: string;
  entityId: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AttachmentsService {
  /**
   * Valida e persiste um novo attachment.
   * Fluxo: validação → SHA-256 → storage → banco → evento.
   */
  async upload(input: UploadInput, user: RequestUser) {
    // 1. Validação de tipo MIME
    if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
      throw new ValidationError(
        `Tipo de arquivo não permitido: ${input.mimeType}. Permitidos: ${[...ALLOWED_MIME_TYPES].join(', ')}`,
      );
    }

    // 2. Validação de tamanho
    if (input.buffer.length > MAX_FILE_SIZE) {
      throw new ValidationError(
        `Arquivo muito grande. Tamanho máximo: ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB`,
      );
    }

    // 3. SHA-256
    const hash = createHash('sha256').update(input.buffer).digest('hex');

    // 4. Geração da storage key com estrutura YYYY/MM/<uuid>.<ext>
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const ext = extname(input.originalName).toLowerCase() || this.mimeToExt(input.mimeType);
    const storageKey = `${year}/${month}/${randomUUID()}${ext}`;

    // 5. Upload para o storage
    const storage = getStorageProvider();
    const timer = storageOperationDuration.startTimer({
      operation: 'upload',
      provider: env.STORAGE_PROVIDER,
    });
    let url: string;
    try {
      url = await storage.upload(storageKey, input.buffer, input.mimeType);
    } finally {
      timer();
    }

    // 6. Persiste metadados no banco
    const attachment = await prisma.attachment.create({
      data: {
        companyId: user.companyId,
        entityType: input.entityType,
        entityId: input.entityId,
        filename: storageKey.split('/').pop()!,
        originalName: input.originalName,
        mimeType: input.mimeType,
        size: input.buffer.length,
        storageKey,
        url,
        hash,
        uploadedBy: user.id,
      },
    });

    // 7. Métricas
    uploadBytesTotal.inc({ mime_type: input.mimeType }, input.buffer.length);
    uploadTotal.inc({ mime_type: input.mimeType, storage_provider: env.STORAGE_PROVIDER });

    // 8. Publica evento (best-effort)
    await publish({
      type: 'attachment.uploaded',
      payload: {
        attachmentId: attachment.id,
        companyId: attachment.companyId,
        entityType: attachment.entityType,
        entityId: attachment.entityId,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        size: attachment.size,
        uploadedBy: attachment.uploadedBy,
      },
    });

    return attachment;
  }

  /** Lista attachments de uma entidade com paginação. Scoped por companyId. */
  async list(query: ListAttachmentsQuery, companyId: string) {
    const { page, limit, skip } = parsePagination(query);

    const where = {
      companyId,
      entityType: query.entityType,
      entityId: query.entityId,
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

  /** Busca metadados de um único attachment. Scoped por companyId. */
  async findById(id: string, companyId: string) {
    const attachment = await prisma.attachment.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!attachment) throw new NotFoundError('Anexo');
    return attachment;
  }

  /**
   * Retorna URL para download.
   * - S3: URL pré-assinada (5 min).
   * - Local: buffer para stream.
   */
  async getDownloadUrl(id: string, companyId: string): Promise<{ redirect: true; url: string } | { redirect: false; buffer: Buffer; mimeType: string; originalName: string }> {
    const attachment = await this.findById(id, companyId);
    const storage = getStorageProvider();

    if (env.STORAGE_PROVIDER === 's3') {
      const s3 = storage as S3StorageProvider;
      const url = await s3.signedUrl(attachment.storageKey);
      return { redirect: true, url };
    }

    const timer = storageOperationDuration.startTimer({ operation: 'download', provider: 'local' });
    let buffer: Buffer;
    try {
      buffer = await storage.download(attachment.storageKey);
    } finally {
      timer();
    }

    return {
      redirect: false,
      buffer,
      mimeType: attachment.mimeType,
      originalName: attachment.originalName,
    };
  }

  /**
   * Soft delete: marca deletedAt + remove arquivo do storage + publica evento.
   */
  async softDelete(id: string, user: RequestUser) {
    const attachment = await prisma.attachment.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
    });
    if (!attachment) throw new NotFoundError('Anexo');

    // Marca como deletado no banco
    await prisma.attachment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Remove do storage (best-effort — não falha a requisição)
    try {
      const storage = getStorageProvider();
      const timer = storageOperationDuration.startTimer({
        operation: 'delete',
        provider: env.STORAGE_PROVIDER,
      });
      try {
        await storage.delete(attachment.storageKey);
      } finally {
        timer();
      }
    } catch (err) {
      console.error({ event: 'storage_delete_error', attachmentId: id, err: (err as Error).message });
    }

    // Publica evento (best-effort)
    await publish({
      type: 'attachment.deleted',
      payload: {
        attachmentId: attachment.id,
        companyId: attachment.companyId,
        entityType: attachment.entityType,
        entityId: attachment.entityId,
        deletedBy: user.id,
      },
    });

    return { id, deleted: true };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private mimeToExt(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'application/zip': '.zip',
      'text/plain': '.txt',
    };
    return map[mimeType] ?? '';
  }
}
