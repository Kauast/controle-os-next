import 'dotenv/config';
import { buildApp } from './app';
import { env } from './env';
import { prisma } from './lib/prisma';
import { connectPublisher, closePublisher } from './lib/publisher';
import { startConsumer } from './lib/consumer';

async function bootstrap() {
  const app = await buildApp();

  // Conectar ao RabbitMQ (publisher)
  try {
    await connectPublisher();
  } catch (err) {
    app.log.warn({ err }, 'RabbitMQ publisher nao disponivel — continuando sem mensageria');
  }

  // Iniciar consumer RabbitMQ
  let closeConsumer: (() => Promise<void>) | undefined;
  try {
    closeConsumer = await startConsumer();
  } catch (err) {
    app.log.warn({ err }, 'RabbitMQ consumer nao disponivel — eventos nao serao consumidos');
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down...');
    await app.close();
    await closePublisher();
    if (closeConsumer) await closeConsumer();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info(
    { port: env.PORT, env: env.NODE_ENV, version: env.APP_VERSION },
    'Chip Service started',
  );
}

bootstrap().catch((err) => {
  console.error('Failed to start chip-service:', err);
  process.exit(1);
});
