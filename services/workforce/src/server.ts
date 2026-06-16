import { buildApp } from './app';
import { env } from './env';
import { connectPublisher, closePublisher } from './lib/publisher';
import { startConsumer, closeConsumer } from './lib/consumer';
import { prisma } from './lib/prisma';

async function main() {
  const app = buildApp();

  // Conecta publisher e consumer antes de aceitar tráfego
  await connectPublisher();
  await startConsumer();

  const address = await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`Workforce Service running at ${address}`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down...');
    await app.close();
    await closeConsumer();
    await closePublisher();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
