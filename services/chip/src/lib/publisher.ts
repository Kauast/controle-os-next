import amqplib, { Channel } from 'amqplib';
import { env } from '../env';
import { chipEventsTotal } from './metrics';
import pino from 'pino';

const logger = pino({ level: env.LOG_LEVEL });

let connection: amqplib.ChannelModel | null = null;
let channel: Channel | null = null;

export async function connectPublisher(): Promise<void> {
  connection = await amqplib.connect(env.RABBITMQ_URL);
  channel = await connection.createChannel();

  await channel.assertExchange(env.RABBITMQ_EXCHANGE, 'topic', { durable: true });

  connection.on('error', (err) => {
    logger.error({ err }, 'RabbitMQ connection error');
    connection = null;
    channel = null;
  });

  connection.on('close', () => {
    logger.warn('RabbitMQ connection closed — will reconnect on next publish');
    connection = null;
    channel = null;
  });

  logger.info('RabbitMQ publisher connected');
}

export async function publish(routingKey: string, payload: Record<string, unknown>): Promise<void> {
  if (!channel) {
    try {
      await connectPublisher();
    } catch (err) {
      logger.error({ err, routingKey }, 'Failed to reconnect to RabbitMQ — skipping publish');
      chipEventsTotal.inc({ event: routingKey, result: 'error' });
      return;
    }
  }

  const content = Buffer.from(JSON.stringify(payload));

  channel!.publish(env.RABBITMQ_EXCHANGE, routingKey, content, {
    persistent: true,
    contentType: 'application/json',
    timestamp: Math.floor(Date.now() / 1000),
  });

  chipEventsTotal.inc({ event: routingKey, result: 'ok' });
  logger.debug({ routingKey }, 'Event published');
}

export async function closePublisher(): Promise<void> {
  try {
    await channel?.close();
    await connection?.close();
  } catch {
    // ignorar erros no fechamento
  }
}
