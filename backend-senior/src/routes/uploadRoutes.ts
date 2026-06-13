import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { authenticate } from '../middlewares/auth';

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
  const baseUrl = (process.env.UPLOAD_BASE_URL || 'http://localhost:3000/uploads').replace(/\/$/, '');
  return `${baseUrl}/${subDir}/${filename}`;
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
  const publicUrl = (process.env.S3_PUBLIC_URL ?? '').replace(/\/$/, '');
  return `${publicUrl}/${key}`;
}

export default async function uploadRoutes(app: FastifyInstance) {
  await app.register(multipart, { limits: { fileSize: MAX_FILE_SIZE } });

  app.post(
    '/api/uploads',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
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
      const url = useS3
        ? await saveS3(buffer, filename, subDir, data.mimetype)
        : await saveLocal(buffer, filename, subDir);

      return reply.status(201).send({ url });
    },
  );
}
