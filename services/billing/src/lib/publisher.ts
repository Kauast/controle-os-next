import amqplib, { ConfirmChannel } from 'amqplib';
import { env } from '../env';
import { amqpEventsTotal } from './metrics';

let connection: amqplib.ChannelModel | null = null;
let channel: ConfirmChannel | null = null;

async function getChannel(): Promise<ConfirmChannel> {
  if (channel) return channel;

  connection = await amqplib.connect(env.rabbitmqUrl);
  channel    = await connection.createConfirmChannel();

  await channel.assertExchange(env.rabbitmqExchange, 'topic', { durable: true });

  connection.on('error', (err) => {
    console.error('[publisher] conexão AMQP encerrada com erro', err.message);
    channel    = null;
    connection = null;
  });
  connection.on('close', () => {
    channel    = null;
    connection = null;
  });

  return channel;
}

export async function publish(routingKey: string, payload: unknown): Promise<void> {
  try {
    const ch  = await getChannel();
    const buf = Buffer.from(JSON.stringify(payload));

    await new Promise<void>((resolve, reject) => {
      const ok = ch.publish(env.rabbitmqExchange, routingKey, buf, {
        persistent:  true,
        contentType: 'application/json',
        timestamp:   Date.now(),
      }, (err) => {
        if (err) reject(err);
        else     resolve();
      });
      if (!ok) {
        // canal em drain — aguarda evento drain antes de resolver
        ch.once('drain', resolve);
      }
    });

    amqpEventsTotal.inc({ direction: 'publish', routing_key: routingKey, result: 'ok' });
  } catch (err) {
    amqpEventsTotal.inc({ direction: 'publish', routing_key: routingKey, result: 'error' });
    channel = null;
    throw err;
  }
}

export async function closePublisher(): Promise<void> {
  try {
    await channel?.close();
    await connection?.close();
  } catch {
    // silencia erros no shutdown
  } finally {
    channel    = null;
    connection = null;
  }
}
