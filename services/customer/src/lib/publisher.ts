import amqplib, { Channel } from 'amqplib';
import { env } from '../env';
import { logger } from './logger';

const EXCHANGE = env.RABBITMQ_EXCHANGE;
const EXCHANGE_TYPE = 'topic';

let connection: amqplib.ChannelModel | null = null;
let channel: Channel | null = null;
let connecting = false;

async function connect(): Promise<void> {
  if (connecting) return;
  connecting = true;
  try {
    connection = await amqplib.connect(env.RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE, EXCHANGE_TYPE, { durable: true });

    connection.on('error', (err) => {
      logger.warn({ err: err.message }, 'RabbitMQ connection error — will reconnect');
      channel = null;
      connection = null;
      connecting = false;
      setTimeout(connect, 5000);
    });

    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed — will reconnect');
      channel = null;
      connection = null;
      connecting = false;
      setTimeout(connect, 5000);
    });

    logger.info('RabbitMQ connected');
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'RabbitMQ unavailable — service continues without messaging');
    channel = null;
    connection = null;
  } finally {
    connecting = false;
  }
}

export async function initPublisher(): Promise<void> {
  await connect();
}

export interface DomainEvent {
  eventType: string;
  companyId: string;
  payload: Record<string, unknown>;
  schemaVersion: '1';
  timestamp: string;
}

export async function publish(event: DomainEvent): Promise<void> {
  if (!channel) {
    logger.warn({ eventType: event.eventType }, 'RabbitMQ channel unavailable — event not published');
    return;
  }

  try {
    const content = Buffer.from(JSON.stringify(event));
    channel.publish(EXCHANGE, event.eventType, content, {
      persistent: true,
      contentType: 'application/json',
    });
    logger.debug({ eventType: event.eventType, companyId: event.companyId }, 'Event published');
  } catch (err) {
    logger.warn({ err: (err as Error).message, eventType: event.eventType }, 'Failed to publish event');
  }
}

export async function closePublisher(): Promise<void> {
  try {
    await channel?.close();
    await connection?.close();
  } catch {
    // ignore on shutdown
  }
}
