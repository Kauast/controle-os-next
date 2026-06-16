import amqp from 'amqplib';
import { logger } from './logger';
import { env } from '../env';

type EventType = 'user.created' | 'user.deactivated' | 'company.created';

interface DomainEvent {
  eventType: EventType;
  companyId: string;
  payload: Record<string, unknown>;
  schemaVersion: '1';
  timestamp: string;
}

let channel: amqp.Channel | null = null;
let connectionAttempted = false;

async function getChannel(): Promise<amqp.Channel | null> {
  if (channel) return channel;
  if (connectionAttempted) return null; // falhou antes — não tenta de novo a cada publicação

  const url = env.RABBITMQ_URL;
  if (!url) {
    logger.warn({ event: 'rabbitmq_not_configured' }, 'RABBITMQ_URL nao definida — eventos nao serao publicados');
    connectionAttempted = true;
    return null;
  }

  try {
    connectionAttempted = true;
    const conn = await amqp.connect(url);

    conn.on('error', (err) => {
      logger.warn({ event: 'rabbitmq_conn_error', err: (err as Error).message }, 'Conexao RabbitMQ encerrada');
      channel = null;
    });

    conn.on('close', () => {
      logger.warn({ event: 'rabbitmq_conn_closed' }, 'Conexao RabbitMQ fechada');
      channel = null;
    });

    channel = await conn.createChannel();
    await channel.assertExchange(env.RABBITMQ_EXCHANGE, 'topic', { durable: true });

    logger.info({ event: 'rabbitmq_connected', exchange: env.RABBITMQ_EXCHANGE }, 'RabbitMQ conectado');
    return channel;
  } catch (err) {
    logger.warn(
      { event: 'rabbitmq_connect_failed', err: (err as Error).message },
      'Falha ao conectar no RabbitMQ — servico continuara sem publicar eventos',
    );
    return null;
  }
}

/**
 * Tenta publicar um evento no RabbitMQ.
 * Se o broker nao estiver disponivel, registra warning e continua sem lancar erro.
 */
export async function publishEvent(
  eventType: EventType,
  companyId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const event: DomainEvent = {
    eventType,
    companyId,
    payload,
    schemaVersion: '1',
    timestamp: new Date().toISOString(),
  };

  const ch = await getChannel();
  if (!ch) {
    logger.warn({ event: 'event_not_published', eventType, companyId }, 'Evento nao publicado — RabbitMQ indisponivel');
    return;
  }

  try {
    const routingKey = eventType; // ex: 'user.created'
    const content = Buffer.from(JSON.stringify(event));
    ch.publish(env.RABBITMQ_EXCHANGE, routingKey, content, {
      persistent: true,
      contentType: 'application/json',
    });
    logger.info({ event: 'event_published', eventType, companyId }, 'Evento publicado');
  } catch (err) {
    logger.warn({ event: 'event_publish_error', eventType, err: (err as Error).message }, 'Erro ao publicar evento');
    channel = null; // reseta para tentar reconectar na proxima
  }
}
