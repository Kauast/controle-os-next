import amqplib, { Channel, Options } from 'amqplib';
import { env } from '../env';
import { amqpEventsTotal } from './metrics';

const EXCHANGE = 'workforce.events';

let connection: amqplib.ChannelModel | null = null;
let channel: Channel | null = null;

export async function connectPublisher(): Promise<void> {
  connection = await amqplib.connect(env.RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
}

export async function publish(
  routingKey: string,
  payload: Record<string, unknown>,
  options?: Options.Publish,
): Promise<void> {
  if (!channel) {
    throw new Error('Publisher channel not initialized. Call connectPublisher() first.');
  }

  const content = Buffer.from(JSON.stringify({ ...payload, timestamp: new Date().toISOString() }));

  channel.publish(EXCHANGE, routingKey, content, {
    contentType: 'application/json',
    persistent: true,
    ...options,
  });

  amqpEventsTotal.inc({ event: routingKey, result: 'published' });
}

export async function closePublisher(): Promise<void> {
  await channel?.close();
  await connection?.close();
  channel = null;
  connection = null;
}
