import 'dotenv/config';
import { env } from './env';
import { buildApp } from './app';
import { prisma } from './lib/prisma';
import { logger } from './lib/logger';

async function main() {
  // env já foi validado ao importar — se falhar, o processo encerra aqui
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    logger.info({ event: 'shutdown_start', signal }, `Recebido ${signal}, encerrando graciosamente`);
    try {
      await app.close();
      await prisma.$disconnect();
      logger.info({ event: 'shutdown_complete' }, 'Identity Service encerrado com sucesso');
      process.exit(0);
    } catch (err) {
      logger.error({ event: 'shutdown_error', err }, 'Erro ao encerrar servidor');
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  app.listen({ port: env.PORT, host: '0.0.0.0' }, (err) => {
    if (err) {
      logger.error({ event: 'startup_error', err }, 'Falha ao iniciar Identity Service');
      process.exit(1);
    }
    logger.info(
      { event: 'startup_complete', port: env.PORT, env: env.NODE_ENV },
      `Identity Service iniciado na porta ${env.PORT}`,
    );
  });
}

main().catch((err) => {
  console.error('Falha fatal na inicializacao:', err);
  process.exit(1);
});
