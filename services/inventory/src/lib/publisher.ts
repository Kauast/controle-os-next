import amqp, { Channel } from 'amqplib';
import { env } from '../env';
import { amqpPublishedTotal } from './metrics';

interface PublishOptions {
  persistent?: boolean;
}

let connection: amqp.ChannelModel | null = null;
let channel: Channel | null = null;
let reconnecting = false;

async function connect(): Promise<Channel> {
  connection = await amqp.connect(env.RABBITMQ_URL);
  channel = await connection.createChannel();

  await channel.assertExchange(env.RABBITMQ_EXCHANGE, 'topic', { durable: true });

  connection.on('error', (err) => {
    console.error('[publisher] Conexao RabbitMQ perdida:', err.message);
    channel = null;
    connection = null;
    scheduleReconnect();
  });

  connection.on('close', () => {
    console.warn('[publisher] Conexao RabbitMQ fechada');
    channel = null;
    connection = null;
    scheduleReconnect();
  });

  console.info('[publisher] Conectado ao RabbitMQ');
  return channel;
}

function scheduleReconnect() {
  if (reconnecting) return;
  reconnecting = true;
  setTimeout(async () => {
    try {
      await connect();
      reconnecting = false;
    } catch (err) {
      console.error('[publisher] Falha ao reconectar:', err);
      reconnecting = false;
      scheduleReconnect();
    }
  }, 5000);
}

export async function initPublisher(): Promise<void> {
  await connect();
}

export async function publish(
  routingKey: string,
  payload: Record<string, unknown>,
  options: PublishOptions = {},
): Promise<void> {
  try {
    if (!channel) {
      throw new Error('Canal AMQP nao disponivel');
    }

    const content = Buffer.from(JSON.stringify(payload));
    channel.publish(env.RABBITMQ_EXCHANGE, routingKey, content, {
      persistent: options.persistent ?? true,
      contentType: 'application/json',
      timestamp: Date.now(),
    });

    amqpPublishedTotal.inc({ routing_key: routingKey, result: 'success' });
  } catch (err) {
    amqpPublishedTotal.inc({ routing_key: routingKey, result: 'error' });
    console.error(`[publisher] Erro ao publicar ${routingKey}:`, err);
    throw err;
  }
}

export async function closePublisher(): Promise<void> {
  try {
    await channel?.close();
    await connection?.close();
  } catch {
    // ignorar erros no shutdown
  }
}
