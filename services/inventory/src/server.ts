import 'dotenv/config';
import { buildApp } from './app';
import { env } from './env';
import { initPublisher, closePublisher } from './lib/publisher';
import { startConsumer, closeConsumer, registerHandler } from './lib/consumer';
import { StockService } from './modules/stock/stock.service';
import { prisma } from './lib/prisma';

const stockService = new StockService();

// ── Handlers AMQP ────────────────────────────────────────────────────────────

// os.cancelled → liberar todas as reservas ativas da OS
registerHandler('os.cancelled', async (payload) => {
  const { companyId, serviceOrderId } = payload as { companyId: string; serviceOrderId: string };
  if (!companyId || !serviceOrderId) return;
  console.info(`[consumer] os.cancelled → liberando reservas da OS ${serviceOrderId}`);
  await stockService.releaseAllReservationsByOrder(companyId, serviceOrderId);
});

// os.completed → consumir todas as reservas ativas da OS
registerHandler('os.completed', async (payload) => {
  const { companyId, serviceOrderId, userId } = payload as {
    companyId: string;
    serviceOrderId: string;
    userId: string;
  };
  if (!companyId || !serviceOrderId) return;
  console.info(`[consumer] os.completed → consumindo reservas da OS ${serviceOrderId}`);
  await stockService.consumeAllReservationsByOrder(companyId, serviceOrderId, userId ?? 'system');
});

// os.created → apenas log; reserva vem via REST
registerHandler('os.created', async (payload) => {
  const { serviceOrderId } = payload as { serviceOrderId: string };
  console.info(`[consumer] os.created recebido para OS ${serviceOrderId} (sem acao de reserva)`);
});

// ── Bootstrap ────────────────────────────────────────────────────────────────

async function main() {
  const app = await buildApp();

  // Conectar ao RabbitMQ
  await initPublisher();
  await startConsumer();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.info(`Recebido ${signal}, encerrando...`);
    await app.close();
    await closeConsumer();
    await closePublisher();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await app.listen({ port: env.PORT, host: env.HOST });
  console.info(`Inventory Service rodando em http://${env.HOST}:${env.PORT}`);
}

main().catch((err) => {
  console.error('Erro fatal ao iniciar o servico:', err);
  process.exit(1);
});
