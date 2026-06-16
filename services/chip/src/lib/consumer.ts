import amqplib, { Channel, ConsumeMessage } from 'amqplib';
import { env } from '../env';
import pino from 'pino';
import { ChipService } from '../modules/chips/chips.service';

const logger = pino({ level: env.LOG_LEVEL });
const chipService = new ChipService();

interface OsCompletedPayload {
  serviceOrderId: string;
  companyId: string;
  chipIccid?: string;
  userId?: string;
  userName?: string;
}

interface ClientDeletedPayload {
  clientId: string;
  companyId: string;
  userId?: string;
  userName?: string;
}

async function handleOsCompleted(payload: OsCompletedPayload): Promise<void> {
  const { serviceOrderId, companyId, chipIccid, userId, userName } = payload;

  if (!chipIccid) {
    logger.debug({ serviceOrderId }, 'os.completed sem chipIccid — ignorando');
    return;
  }

  await chipService.installByOs(serviceOrderId, companyId, chipIccid, userId, userName);
  logger.info({ serviceOrderId, chipIccid }, 'Chip instalado via os.completed');
}

async function handleClientDeleted(payload: ClientDeletedPayload): Promise<void> {
  const { clientId, companyId, userId, userName } = payload;
  await chipService.releaseByClient(clientId, companyId, userId, userName);
  logger.info({ clientId, companyId }, 'Chips liberados via client.deleted');
}

function safeParse<T>(msg: ConsumeMessage): T | null {
  try {
    return JSON.parse(msg.content.toString()) as T;
  } catch {
    return null;
  }
}

async function setupQueue(
  ch: Channel,
  queueName: string,
  routingKey: string,
): Promise<void> {
  await ch.assertQueue(queueName, { durable: true, arguments: { 'x-dead-letter-exchange': `${env.RABBITMQ_EXCHANGE}.dlx` } });
  await ch.bindQueue(queueName, env.RABBITMQ_EXCHANGE, routingKey);
}

export async function startConsumer(): Promise<() => Promise<void>> {
  let conn: amqplib.ChannelModel | null = null;
  let ch: Channel | null = null;

  async function connect() {
    conn = await amqplib.connect(env.RABBITMQ_URL);
    ch = await conn.createChannel();

    // Exchange principal e DLX
    await ch.assertExchange(env.RABBITMQ_EXCHANGE, 'topic', { durable: true });
    await ch.assertExchange(`${env.RABBITMQ_EXCHANGE}.dlx`, 'fanout', { durable: true });

    await setupQueue(ch, env.RABBITMQ_QUEUE_OS_COMPLETED, 'os.completed');
    await setupQueue(ch, env.RABBITMQ_QUEUE_CLIENT_DELETED, 'client.deleted');

    // Prefetch 1: processa uma mensagem por vez para garantir ordem e evitar sobrecarga
    ch.prefetch(1);

    ch.consume(env.RABBITMQ_QUEUE_OS_COMPLETED, async (msg) => {
      if (!msg) return;
      const payload = safeParse<OsCompletedPayload>(msg);
      if (!payload) {
        logger.warn({ queue: env.RABBITMQ_QUEUE_OS_COMPLETED }, 'Mensagem malformada — descartando');
        ch!.nack(msg, false, false);
        return;
      }
      try {
        await handleOsCompleted(payload);
        ch!.ack(msg);
      } catch (err) {
        logger.error({ err, payload }, 'Erro ao processar os.completed');
        ch!.nack(msg, false, false); // vai para DLX
      }
    });

    ch.consume(env.RABBITMQ_QUEUE_CLIENT_DELETED, async (msg) => {
      if (!msg) return;
      const payload = safeParse<ClientDeletedPayload>(msg);
      if (!payload) {
        logger.warn({ queue: env.RABBITMQ_QUEUE_CLIENT_DELETED }, 'Mensagem malformada — descartando');
        ch!.nack(msg, false, false);
        return;
      }
      try {
        await handleClientDeleted(payload);
        ch!.ack(msg);
      } catch (err) {
        logger.error({ err, payload }, 'Erro ao processar client.deleted');
        ch!.nack(msg, false, false);
      }
    });

    conn.on('error', (err) => {
      logger.error({ err }, 'RabbitMQ consumer connection error');
    });

    conn.on('close', () => {
      logger.warn('RabbitMQ consumer connection closed — reconectando em 5s');
      setTimeout(connect, 5000);
    });

    logger.info('RabbitMQ consumer started');
  }

  await connect();

  return async function close() {
    try {
      await ch?.close();
      await conn?.close();
    } catch {
      // ignorar
    }
  };
}
