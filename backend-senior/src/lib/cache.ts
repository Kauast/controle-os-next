import Redis from 'ioredis';
import { logger } from './logger';
import { cacheOperations } from './metrics';

// Conexão Redis dedicada ao cache (separada da fila BullMQ).
export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 2,
  lazyConnect: false,
  enableOfflineQueue: true,
});

redis.on('error', (err) => {
  logger.error({ event: 'cache_error', err: err.message }, 'Erro na conexão de cache (Redis)');
});

const NAME = 'app';

// Regra 6: toda operação de cache registra hit ou miss (métrica + log).
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await redis.get(key);
      if (raw === null) {
        cacheOperations.inc({ cache: NAME, result: 'miss' });
        logger.debug({ event: 'cache_miss', key }, 'cache_miss');
        return null;
      }
      cacheOperations.inc({ cache: NAME, result: 'hit' });
      logger.debug({ event: 'cache_hit', key }, 'cache_hit');
      return JSON.parse(raw) as T;
    } catch (err) {
      cacheOperations.inc({ cache: NAME, result: 'error' });
      logger.warn({ event: 'cache_get_failed', key, err: (err as Error).message }, 'Falha ao ler cache');
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      logger.warn({ event: 'cache_set_failed', key, err: (err as Error).message }, 'Falha ao gravar cache');
    }
  },

  async del(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length) await redis.del(...keys);
    } catch (err) {
      logger.warn({ event: 'cache_del_failed', pattern, err: (err as Error).message }, 'Falha ao invalidar cache');
    }
  },

  // Helper read-through: busca no cache; se miss, executa o loader e popula.
  async remember<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await loader();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  },
};
