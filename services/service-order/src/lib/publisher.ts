import amqplib, { Channel } from 'amqplib';
import { env } from '../env';

interface PublishOptions {
  routingKey: string;
  payload: Record<string, unknown>;
  messageId?: string;
}

let connection: amqplib.ChannelModel | null = null;
let channel: Channel | null = null;

export async function connectRabbitMQ(): Promise<void> {
  try {
    connection = await amqplib.connect(env.rabbitmqUrl);
    channel = await connection.createChannel();

    await channel.assertExchange(env.rabbitmqExchange, 'topic', { durable: true });

    // Dead Letter Queue para mensagens que não puderam ser processadas
    await channel.assertQueue(env.rabbitmqDlq, { durable: true });

    connection.on('error', (err) => {
      console.error('[rabbitmq] Conexão perdida:', err.message);
      connection = null;
      channel = null;
    });

    connection.on('close', () => {
      console.warn('[rabbitmq] Conexão fechada');
      connection = null;
      channel = null;
    });

    console.info('[rabbitmq] Conectado ao RabbitMQ');
  } catch (err) {
    console.error('[rabbitmq] Falha ao conectar:', (err as Error).message);
    // Não lança — o serviço pode operar degradado sem mensageria
  }
}

export async function publish(opts: PublishOptions): Promise<boolean> {
  if (!channel) {
    console.warn('[rabbitmq] Canal não disponível — evento não publicado:', opts.routingKey);
    return false;
  }

  const content = Buffer.from(JSON.stringify({
    ...opts.payload,
    _meta: {
      routingKey: opts.routingKey,
      publishedAt: new Date().toISOString(),
      messageId: opts.messageId ?? crypto.randomUUID(),
    },
  }));

  try {
    channel.publish(env.rabbitmqExchange, opts.routingKey, content, {
      persistent: true,
      contentType: 'application/json',
      messageId: opts.messageId ?? crypto.randomUUID(),
      timestamp: Date.now(),
    });
    return true;
  } catch (err) {
    console.error('[rabbitmq] Falha ao publicar evento:', opts.routingKey, (err as Error).message);
    return false;
  }
}

export async function closeRabbitMQ(): Promise<void> {
  try {
    await channel?.close();
    await connection?.close();
  } catch {
    // silencioso no shutdown
  }
}
