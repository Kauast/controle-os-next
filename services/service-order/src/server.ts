import 'dotenv/config';
import { validateEnv, env } from './env';
import { buildApp } from './app';
import { prisma } from './lib/prisma';
import { connectRabbitMQ, closeRabbitMQ } from './lib/publisher';
import { startConsumers, stopConsumers } from './lib/consumer';
import pino from 'pino';

const logger = pino({
  level: env.logLevel,
  transport: env.isProd ? undefined : { target: 'pino-pretty', options: { colorize: true } },
});

// Valida variáveis obrigatórias antes de qualquer inicialização
validateEnv();

async function main() {
  const app = await buildApp();

  // Conecta ao RabbitMQ (não fatal — o serviço opera degradado sem mensageria)
  await connectRabbitMQ();
  await startConsumers();

  const shutdown = async (signal: string) => {
    logger.info({ event: 'shutdown_start', signal }, `Recebido ${signal}, encerrando graciosamente`);
    try {
      await app.close();
      await stopConsumers();
      await closeRabbitMQ();
      await (prisma as unknown as { $disconnect: () => Promise<void> }).$disconnect();
      logger.info({ event: 'shutdown_complete' }, 'Servidor encerrado com sucesso');
      process.exit(0);
    } catch (err) {
      logger.error({ event: 'shutdown_error', err }, 'Erro ao encerrar servidor');
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT',  () => shutdown('SIGINT'));

  app.listen({ port: env.port, host: '0.0.0.0' }, (err) => {
    if (err) {
      logger.error(err);
      process.exit(1);
    }
    logger.info({ event: 'server_started', port: env.port }, `Service Order Svc rodando na porta ${env.port}`);
  });
}

main();
