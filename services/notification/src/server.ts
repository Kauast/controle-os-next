import 'dotenv/config';
import { validateEnv, env } from './env';
import { buildApp } from './app';
import { prisma } from './lib/prisma';
import { logger } from './lib/logger';
import { startConsumer, stopConsumer } from './lib/consumer';

validateEnv();

async function main(): Promise<void> {
  const app = await buildApp();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ event: 'shutdown_start', signal }, `Recebido ${signal}, encerrando graciosamente`);
    try {
      await app.close();
      await stopConsumer();
      await prisma.$disconnect();
      logger.info({ event: 'shutdown_complete' }, 'Servico encerrado com sucesso');
      process.exit(0);
    } catch (err) {
      logger.error({ event: 'shutdown_error', err }, 'Erro ao encerrar servico');
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT',  () => shutdown('SIGINT'));

  // Inicia o servidor HTTP
  app.listen({ port: env.port, host: '0.0.0.0' }, (err) => {
    if (err) {
      logger.error({ event: 'startup_error', err }, 'Falha ao iniciar servidor HTTP');
      process.exit(1);
    }
    logger.info({ event: 'server_started', port: env.port }, `Notification service escutando na porta ${env.port}`);
  });

  // Inicia o consumer RabbitMQ
  try {
    await startConsumer();
  } catch (err) {
    logger.error({ event: 'consumer_startup_error', err }, 'Falha ao iniciar consumer RabbitMQ — tentando em 10s');
    setTimeout(() => {
      startConsumer().catch((e) =>
        logger.error({ event: 'consumer_retry_error', err: e }, 'Falha definitiva ao conectar ao RabbitMQ'),
      );
    }, 10_000);
  }
}

main();
