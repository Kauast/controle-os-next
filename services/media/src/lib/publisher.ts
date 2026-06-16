import amqplib, { Channel } from 'amqplib';
import { env } from '../env';

const EXCHANGE = 'media.events';
const EXCHANGE_TYPE = 'topic';

let connection: amqplib.ChannelModel | null = null;
let channel: Channel | null = null;

async function getChannel(): Promise<Channel> {
  if (channel) return channel;

  connection = await amqplib.connect(env.RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE, EXCHANGE_TYPE, { durable: true });

  connection.on('error', (err) => {
    console.error({ event: 'rabbitmq_conn_error', err: err.message }, 'Erro na conexão RabbitMQ');
    channel = null;
    connection = null;
  });

  connection.on('close', () => {
    channel = null;
    connection = null;
  });

  return channel;
}

export type MediaEvent =
  | { type: 'attachment.uploaded'; payload: AttachmentUploadedPayload }
  | { type: 'attachment.deleted'; payload: AttachmentDeletedPayload };

export interface AttachmentUploadedPayload {
  attachmentId: string;
  companyId: string;
  entityType: string;
  entityId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
}

export interface AttachmentDeletedPayload {
  attachmentId: string;
  companyId: string;
  entityType: string;
  entityId: string;
  deletedBy: string;
}

export async function publish(event: MediaEvent): Promise<void> {
  try {
    const ch = await getChannel();
    const routingKey = event.type; // ex.: "attachment.uploaded"
    const content = Buffer.from(
      JSON.stringify({ ...event.payload, eventType: event.type, ts: new Date().toISOString() }),
    );
    ch.publish(EXCHANGE, routingKey, content, {
      persistent: true,
      contentType: 'application/json',
    });
  } catch (err) {
    // Publica com best-effort — falha no broker não deve derrubar a requisição
    console.error({ event: 'rabbitmq_publish_error', err: (err as Error).message }, 'Falha ao publicar evento');
  }
}

export async function closePublisher(): Promise<void> {
  try {
    await channel?.close();
    await connection?.close();
  } catch {
    // silencioso no shutdown
  }
  channel = null;
  connection = null;
}
