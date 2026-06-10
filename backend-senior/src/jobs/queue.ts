import { Queue, Worker } from 'bullmq';

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
        console.log(`Notificando cliente da OS ${job.data.osId}`);
        break;
      case 'os.cancelled':
        console.log(`OS ${job.data.osId} cancelada. Motivo: ${job.data.reason}`);
        break;
      default:
        console.warn(`Job desconhecido: ${job.name}`);
    }
  },
  { connection: redisConnection }
);

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} falhou:`, err.message);
});
