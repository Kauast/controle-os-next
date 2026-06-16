import 'dotenv/config';
import { validateEnv, env } from './env';
import { buildApp } from './app';
import { prisma } from './lib/prisma';
import { startConsumer, closeConsumer } from './lib/consumer';
import { closePublisher } from './lib/publisher';
import cron from 'node-cron';
import { invoicesService } from './modules/invoices/invoices.service';

validateEnv();

async function main() {
  const app = await buildApp();

  // ── Consumer RabbitMQ ─────────────────────────────────────────────────────
  try {
    await startConsumer();
  } catch (err) {
    console.error('[server] Falha ao iniciar consumer AMQP — serviço continuará sem consumo de eventos:', err);
  }

  // ── Cron: checar faturas vencidas ─────────────────────────────────────────
  cron.schedule(env.overdueCron, async () => {
    try {
      const count = await invoicesService.markOverdue();
      if (count > 0) {
        console.info(`[cron] ${count} fatura(s) marcadas como OVERDUE`);
      }
    } catch (err) {
      console.error('[cron] Erro ao marcar faturas vencidas:', err);
    }
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    console.info(`[server] Recebido ${signal}, encerrando graciosamente`);
    try {
      await app.close();
      await closeConsumer();
      await closePublisher();
      await prisma.$disconnect();
      console.info('[server] Billing service encerrado com sucesso');
      process.exit(0);
    } catch (err) {
      console.error('[server] Erro ao encerrar:', err);
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT',  () => shutdown('SIGINT'));

  // ── Listen ────────────────────────────────────────────────────────────────
  app.listen({ port: env.port, host: '0.0.0.0' }, (err) => {
    if (err) {
      console.error('[server] Erro ao iniciar:', err);
      process.exit(1);
    }
    console.info(`[server] billing-service ouvindo em http://0.0.0.0:${env.port}`);
  });
}

main();
