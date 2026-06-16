import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createHash } from 'crypto';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1h
const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

declare module 'fastify' {
  interface FastifyRequest {
    _idem?: { key: string; companyId: string; requestHash: string };
  }
}

function hashRequest(req: FastifyRequest): string {
  const raw = JSON.stringify({ url: req.url, body: req.body ?? null });
  return createHash('sha256').update(raw).digest('hex');
}

/** Remove chaves de idempotência expiradas. Exportada para teste/uso manual. */
export async function cleanupExpiredIdempotencyKeys(): Promise<number> {
  const { count } = await prisma.idempotencyKey.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}

export function registerIdempotency(app: FastifyInstance): void {
  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    const key = req.headers['idempotency-key'] as string | undefined;
    if (!key || !MUTATING.has(req.method)) return;

    const user = req.user as { companyId?: string } | undefined;
    const companyId = user?.companyId ?? 'anon';
    const requestHash = hashRequest(req);

    const existing = await prisma.idempotencyKey.findUnique({
      where: { companyId_key: { companyId, key } },
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new AppError(
          'Idempotency-Key reutilizada com payload diferente',
          422,
          'IDEMPOTENCY_KEY_REUSE',
        );
      }
      reply.header('idempotent-replayed', 'true');
      return reply.status(existing.statusCode).send(existing.responseBody);
    }

    req._idem = { key, companyId, requestHash };
  });

  app.addHook('onSend', async (req: FastifyRequest, reply: FastifyReply, payload: unknown) => {
    const idem = req._idem;
    // Só persiste respostas finais bem-sucedidas (2xx); erros podem ser reprocessados.
    if (!idem || reply.statusCode >= 300) return payload;
    const body = typeof payload === 'string' ? safeParse(payload) : payload;
    try {
      await prisma.idempotencyKey.create({
        data: {
          companyId: idem.companyId,
          key: idem.key,
          method: req.method,
          path: req.url,
          requestHash: idem.requestHash,
          statusCode: reply.statusCode,
          responseBody: body as object,
          expiresAt: new Date(Date.now() + TTL_MS),
        },
      });
    } catch {
      // Corrida: outra requisição com a mesma chave já persistiu — ignora.
    }
    return payload;
  });

  // Limpeza periódica de chaves expiradas — encerra junto com a app.
  const timer = setInterval(() => {
    cleanupExpiredIdempotencyKeys().catch((err) =>
      logger.warn({ event: 'idempotency_cleanup_failed', err: (err as Error).message }, 'Falha ao limpar chaves de idempotência'),
    );
  }, CLEANUP_INTERVAL_MS);
  timer.unref?.();
  app.addHook('onClose', async () => clearInterval(timer));
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
