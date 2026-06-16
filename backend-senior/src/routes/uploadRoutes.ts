import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';
import { writeFile, mkdir } from 'fs/promises';
import { createReadStream as fsCreateReadStream, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID, createHash } from 'crypto';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth';
import { AttachmentService } from '../services/attachmentService';
import { ForbiddenError, NotFoundError } from '../shared/errors';
import { prisma } from '../lib/prisma';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png':  [[0x89, 0x50, 0x4e, 0x47]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
  'image/gif':  [[0x47, 0x49, 0x46, 0x38]],
};

function validMagicBytes(buffer: Buffer, mimetype: string): boolean {
  const signatures = MAGIC_BYTES[mimetype];
  if (!signatures) return false;
  return signatures.some((sig) => sig.every((byte, i) => buffer[i] === byte));
}

function buildSubDir(): string {
  const now = new Date();
  return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function buildFilename(mimetype: string): string {
  const ext = mimetype.split('/')[1].replace('jpeg', 'jpg');
  return `${randomUUID()}.${ext}`;
}

async function saveLocal(buffer: Buffer, filename: string, subDir: string): Promise<string> {
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  const dir = join(uploadDir, subDir);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), buffer);
  // Retorna o storagePath relativo — não a URL pública
  return `${subDir}/${filename}`;
}

async function saveS3(buffer: Buffer, filename: string, subDir: string, mimetype: string): Promise<string> {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? '',
      secretAccessKey: process.env.S3_SECRET_KEY ?? '',
    },
    forcePathStyle: true,
  });
  const key = `${subDir}/${filename}`;
  await client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET ?? 'controle-os-uploads',
    Key: key,
    Body: buffer,
    ContentType: mimetype,
  }));
  return key;
}

async function getSignedS3Url(storagePath: string): Promise<string> {
  // Importações dinâmicas — módulos S3 são opcionais (carregados só quando STORAGE_PROVIDER=s3)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
  // @aws-sdk/s3-request-presigner deve ser instalado quando STORAGE_PROVIDER=s3
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  const client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? '',
      secretAccessKey: process.env.S3_SECRET_KEY ?? '',
    },
    forcePathStyle: true,
  });
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET ?? 'controle-os-uploads', Key: storagePath }),
    { expiresIn: 300 }, // 5 minutos
  ) as Promise<string>;
}

const attachmentService = new AttachmentService();

interface RequestUser {
  id: string;
  role: string;
  companyId: string;
}

export default async function uploadRoutes(app: FastifyInstance) {
  await app.register(multipart, { limits: { fileSize: MAX_FILE_SIZE } });

  // POST /api/uploads — upload autenticado
  // Retorna: { attachmentId, fileName, mimeType, fileSize } — SEM URL pública
  app.post(
    '/api/uploads',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as RequestUser;

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'Nenhum arquivo enviado' });
      }
      if (!ALLOWED_MIME.has(data.mimetype)) {
        return reply.status(400).send({ error: 'Tipo de arquivo não permitido. Use JPEG, PNG ou WebP.' });
      }

      const buffer = await data.toBuffer();

      if (!validMagicBytes(buffer, data.mimetype)) {
        return reply.status(400).send({
          error: 'Conteúdo do arquivo não corresponde ao tipo declarado.',
        });
      }

      const subDir = buildSubDir();
      const filename = buildFilename(data.mimetype);

      const useS3 = process.env.STORAGE_PROVIDER === 's3';
      const storagePath = useS3
        ? await saveS3(buffer, filename, subDir, data.mimetype)
        : await saveLocal(buffer, filename, subDir);

      const hash = createHash('sha256').update(buffer).digest('hex');

      // Lê campos de formulário extras (entityType, entityId, serviceOrderId)
      const entityType = (data.fields?.entityType as { value?: string })?.value ?? 'GENERAL';
      const entityId   = (data.fields?.entityId as { value?: string })?.value ?? user.id;
      const rawServiceOrderId = (data.fields?.serviceOrderId as { value?: string })?.value;

      const serviceOrderIdResult = z.string().cuid().optional().safeParse(rawServiceOrderId ?? undefined);
      if (!serviceOrderIdResult.success) {
        return reply.status(400).send({ error: 'serviceOrderId inválido. Deve ser um CUID válido.' });
      }

      const attachment = await attachmentService.create({
        entityType,
        entityId,
        fileName: filename,
        originalName: data.filename ?? filename,
        mimeType: data.mimetype,
        fileSize: buffer.length,
        storageProvider: useS3 ? 's3' : 'local',
        storagePath,
        hash,
        serviceOrderId: serviceOrderIdResult.data,
      }, user);

      // NÃO retorna URL pública — retorna apenas metadados + ID para download autenticado
      return reply.status(201).send({
        attachmentId: attachment.id,
        fileName: attachment.fileName,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize,
        entityType: attachment.entityType,
        entityId: attachment.entityId,
      });
    },
  );

  // GET /api/attachments/:id/download — download autenticado e escopado
  app.get<{ Params: { id: string } }>(
    '/api/attachments/:id/download',
    { preHandler: authenticate },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = request.user as RequestUser;
      const { id } = request.params;

      // Busca o attachment verificando companyId
      const attachment = await attachmentService.findById(id, user.companyId);

      // RBAC para técnico: só pode baixar anexo de OS atribuída a ele
      if (user.role === 'TECHNICIAN' && attachment.serviceOrderId) {
        const tech = await prisma.technician.findFirst({
          where: { userId: user.id, companyId: user.companyId },
        });
        if (!tech) {
          throw new ForbiddenError('Técnico não vinculado a um registro Technician');
        }
        const os = await prisma.serviceOrder.findFirst({
          where: { id: attachment.serviceOrderId, companyId: user.companyId, technicianId: tech.id },
        });
        if (!os) {
          // 404 evita enumeração (não revela que a OS existe)
          throw new NotFoundError('Anexo');
        }
      }

      const useS3 = attachment.storageProvider === 's3';

      if (useS3) {
        // Redireciona para URL assinada com expiração de 5 min
        const signedUrl = await getSignedS3Url(attachment.storagePath);
        return reply.status(302).redirect(signedUrl);
      }

      // Serve arquivo local via stream
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      const filePath = join(uploadDir, attachment.storagePath);

      if (!existsSync(filePath)) {
        throw new NotFoundError('Arquivo');
      }

      reply.header('Content-Type', attachment.mimeType);
      reply.header('Content-Disposition', `attachment; filename="${attachment.originalName}"`);
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('Cache-Control', 'private, no-store');

      const stream = fsCreateReadStream(filePath);
      return reply.send(stream);
    },
  );
}
