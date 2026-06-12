import { Queue, Worker } from 'bullmq';
import { logger } from '../lib/logger';

const redisUrl = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');

const redisConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null as unknown as number,
};

export const osQueue = new Queue('os-events', { connection: redisConnection });

export const worker = new Worker(
  'os-events',
  async (job) => {
    switch (job.name) {
      case 'os.completed':
        logger.info({ event: 'job_os_completed', jobId: job.id, osId: job.data.osId }, 'OS concluída — notificando cliente');
        break;
      case 'os.cancelled':
        logger.info({ event: 'job_os_cancelled', jobId: job.id, osId: job.data.osId, reason: job.data.reason }, 'OS cancelada');
        break;
      default:
        logger.warn({ event: 'job_unknown', jobId: job.id, jobName: job.name }, 'Job desconhecido recebido');
    }
  },
  { connection: redisConnection }
);

worker.on('failed', (job, err) => {
  logger.error({ event: 'job_failed', jobId: job?.id, jobName: job?.name, err: err.message }, 'Job falhou');
});
