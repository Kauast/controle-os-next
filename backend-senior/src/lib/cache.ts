import Redis from 'ioredis';
import { logger } from './logger';
import { cacheOperations } from './metrics';

// Conexão Redis dedicada ao cache (separada da fila BullMQ).
// lazyConnect: true — não aborta a inicialização se Redis estiver indisponível.
// enableOfflineQueue: false — operações falham imediatamente em vez de acumular na memória.
export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 1,
  lazyConnect: true,
  enableOfflineQueue: false,
  retryStrategy: (times) => {
    if (times > 5) return null; // desiste após 5 tentativas — evita loop infinito
    return Math.min(times * 500, 3000); // backoff: 500ms, 1s, 1.5s, 2s, 2.5s, 3s
  },
});

redis.on('error', (err) => {
  logger.error({ event: 'cache_error', err: err.message }, 'Erro na conexão de cache (Redis)');
});
redis.on('reconnecting', () => {
  logger.warn({ event: 'cache_reconnecting' }, 'Redis reconectando');
});
redis.on('ready', () => {
  logger.info({ event: 'cache_ready' }, 'Redis pronto');
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
