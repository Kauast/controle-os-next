import 'dotenv/config';
import { validateEnv } from './lib/config';
import { buildApp } from './app';
import { prisma } from './lib/prisma';
import { redis } from './lib/cache';
import { logger } from './lib/logger';

// Valida variáveis obrigatórias antes de qualquer inicialização
validateEnv();

async function main() {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    logger.info({ event: 'shutdown_start', signal }, `Recebido ${signal}, encerrando graciosamente`);
    try {
      await app.close();
      await prisma.$disconnect();
      await redis.quit();
      logger.info({ event: 'shutdown_complete' }, 'Servidor encerrado com sucesso');
      process.exit(0);
    } catch (err) {
      logger.error({ event: 'shutdown_error', err }, 'Erro ao encerrar servidor');
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT',  () => shutdown('SIGINT'));

  app.listen({ port: Number(process.env.PORT) || 3333, host: '0.0.0.0' }, (err) => {
    if (err) {
      logger.error(err);
      process.exit(1);
    }
  });
}

main();
