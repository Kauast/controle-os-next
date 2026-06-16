import 'dotenv/config';
import { buildApp } from './app';
import { env } from './env';
import { logger } from './lib/logger';
import { initPublisher, closePublisher } from './lib/publisher';
import { prisma } from './lib/prisma';

async function main() {
  // Conecta RabbitMQ (falha tolerante — warning e continua)
  await initPublisher();

  const app = await buildApp();

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info({ signal }, 'Shutdown signal received');
      try {
        await app.close();
        await closePublisher();
        await prisma.$disconnect();
        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    });
  }

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Customer Service started');
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

main();
