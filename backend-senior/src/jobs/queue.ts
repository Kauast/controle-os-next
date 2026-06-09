import { Queue, Worker } from 'bullmq';

const redisConnection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
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
