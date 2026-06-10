import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { authenticate } from '../middlewares/auth';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

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

      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      const now = new Date();
      const subDir = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
      const dir = join(uploadDir, subDir);

      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      const ext = data.mimetype.split('/')[1].replace('jpeg', 'jpg');
      const filename = `${randomUUID()}.${ext}`;
      const filepath = join(dir, filename);

      const buffer = await data.toBuffer();
      await writeFile(filepath, buffer);

      const baseUrl = (process.env.UPLOAD_BASE_URL || 'http://localhost:3000/uploads').replace(/\/$/, '');
      const url = `${baseUrl}/${subDir}/${filename}`;

      return reply.status(201).send({ url });
    },
  );
}
