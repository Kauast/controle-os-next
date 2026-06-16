import 'dotenv/config';
import { env } from './env';
import { buildApp } from './app';
import { prisma } from './lib/prisma';
import { closePublisher } from './lib/publisher';

async function main() {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info({ event: 'shutdown_start', signal }, `Recebido ${signal}, encerrando graciosamente`);
    try {
      await app.close();
      await prisma.$disconnect();
      await closePublisher();
      app.log.info({ event: 'shutdown_complete' }, 'Media Service encerrado com sucesso');
      process.exit(0);
    } catch (err) {
      app.log.error({ event: 'shutdown_error', err }, 'Erro ao encerrar Media Service');
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  app.listen({ port: env.PORT, host: env.SERVICE_HOST }, (err) => {
    if (err) {
      app.log.error(err);
      process.exit(1);
    }
    app.log.info(
      { event: 'server_started', port: env.PORT, storage: env.STORAGE_PROVIDER },
      `Media Service rodando na porta ${env.PORT}`,
    );
  });
}

main();
