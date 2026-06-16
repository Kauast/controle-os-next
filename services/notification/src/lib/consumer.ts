import amqplib, { type Channel, type ConsumeMessage } from 'amqplib';
import { env } from '../env';
import { logger } from './logger';
import { prisma } from './prisma';
import { sendEmail } from './mailer';
import {
  osCompleted,
  osAssigned,
  osCancelled,
  stockBelowMin,
  invoiceOverdue,
  materialRequestReviewed,
  userCreated,
} from './templates';
import {
  eventsConsumedTotal,
  notificationsSentTotal,
  notificationsRetryTotal,
} from './metrics';
import { NotificationChannel } from '@prisma/client';

// ─── Tipos dos payloads de cada evento ────────────────────────────────────────

interface OsCompletedPayload {
  companyId:    string;
  clientEmail:  string;
  clientName?:  string;
  osCode?:      string;
  companyName?: string;
}

interface OsAssignedPayload {
  companyId:       string;
  technicianEmail: string;
  technicianName?: string;
  osCode?:         string;
  clientName?:     string;
  description?:    string;
}

interface OsCancelledPayload {
  companyId:   string;
  clientEmail: string;
  clientName?: string;
  osCode?:     string;
  reason?:     string;
}

interface StockBelowMinPayload {
  companyId:    string;
  adminEmail:   string;
  adminName?:   string;
  productName?: string;
  currentQty?:  number;
  minQty?:      number;
}

interface InvoiceOverduePayload {
  companyId:      string;
  clientEmail:    string;
  clientName?:    string;
  invoiceNumber?: string;
  dueDate?:       string;
  amount?:        string;
}

interface MaterialRequestReviewedPayload {
  companyId:      string;
  requesterEmail: string;
  requesterName?: string;
  requestCode?:   string;
  status?:        string;
  observation?:   string;
}

interface UserCreatedPayload {
  companyId:    string;
  email:        string;
  name?:        string;
  companyName?: string;
  loginUrl?:    string;
}

type EventPayload =
  | { type: 'os.completed';              data: OsCompletedPayload }
  | { type: 'os.assigned';               data: OsAssignedPayload }
  | { type: 'os.cancelled';              data: OsCancelledPayload }
  | { type: 'stock.below_min';           data: StockBelowMinPayload }
  | { type: 'invoice.overdue';           data: InvoiceOverduePayload }
  | { type: 'material_request.reviewed'; data: MaterialRequestReviewedPayload }
  | { type: 'user.created';              data: UserCreatedPayload };

// ─── Resolve template + destinatario para cada tipo de evento ─────────────────

function resolveEmail(event: EventPayload): { to: string; subject: string; html: string } {
  switch (event.type) {
    case 'os.completed': {
      const { subject, html } = osCompleted(event.data);
      return { to: event.data.clientEmail, subject, html };
    }
    case 'os.assigned': {
      const { subject, html } = osAssigned(event.data);
      return { to: event.data.technicianEmail, subject, html };
    }
    case 'os.cancelled': {
      const { subject, html } = osCancelled(event.data);
      return { to: event.data.clientEmail, subject, html };
    }
    case 'stock.below_min': {
      const { subject, html } = stockBelowMin(event.data);
      return { to: event.data.adminEmail, subject, html };
    }
    case 'invoice.overdue': {
      const { subject, html } = invoiceOverdue(event.data);
      return { to: event.data.clientEmail, subject, html };
    }
    case 'material_request.reviewed': {
      const { subject, html } = materialRequestReviewed(event.data);
      return { to: event.data.requesterEmail, subject, html };
    }
    case 'user.created': {
      const { subject, html } = userCreated(event.data);
      return { to: event.data.email, subject, html };
    }
  }
}

// ─── Reagendamento via fila de retry ──────────────────────────────────────────

function scheduleRetry(channel: Channel, original: ConsumeMessage, retryCount: number): void {
  try {
    channel.publish(
      '',
      env.rabbitmqRetryQueue,
      original.content,
      {
        ...original.properties,
        headers: {
          ...(original.properties.headers as Record<string, unknown> | undefined),
          'x-delay':       env.retryDelayMs,
          'x-retry-count': retryCount,
        },
        // TTL faz a mensagem expirar e retornar via DLX para a fila principal
        expiration: String(env.retryDelayMs),
      },
    );
    logger.info(
      { event: 'retry_scheduled', retryQueue: env.rabbitmqRetryQueue, delay: env.retryDelayMs, retryCount },
      'Notificacao reagendada para retry',
    );
  } catch (err) {
    logger.error({ event: 'retry_publish_error', err }, 'Erro ao publicar mensagem de retry');
  }
}

// ─── Processamento de uma mensagem ────────────────────────────────────────────

async function processMessage(channel: Channel, msg: ConsumeMessage): Promise<void> {
  const eventId   = msg.properties.messageId as string | undefined;
  const eventType = msg.fields.routingKey;

  if (!eventId) {
    logger.warn({ event: 'missing_event_id', routingKey: eventType }, 'Mensagem sem messageId descartada');
    channel.ack(msg);
    return;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(msg.content.toString()) as Record<string, unknown>;
  } catch {
    logger.error({ event: 'invalid_json', eventId, eventType }, 'Payload nao e JSON valido descartado');
    channel.ack(msg);
    return;
  }

  const eventPayload = { type: eventType, data: parsed } as unknown as EventPayload;

  // ── Padrao Inbox: verificar + processar + registrar em transacao atomica ───
  try {
    await prisma.$transaction(async (tx) => {
      const already = await tx.processedEvent.findUnique({ where: { id: eventId } });
      if (already) {
        logger.info({ event: 'event_duplicate', eventId, eventType }, 'Evento ja processado ignorado');
        return;
      }

      let emailOpts: { to: string; subject: string; html: string };
      try {
        emailOpts = resolveEmail(eventPayload);
      } catch (err) {
        logger.error({ event: 'template_error', eventId, eventType, err }, 'Erro ao resolver template');
        await tx.notification.create({
          data: {
            companyId:  (parsed.companyId as string | undefined) ?? 'unknown',
            channel:    NotificationChannel.EMAIL,
            status:     'FAILED',
            recipient:  '',
            subject:    eventType,
            body:       JSON.stringify(parsed),
            errorMsg:   (err as Error).message,
          },
        });
        await tx.processedEvent.create({ data: { id: eventId, eventType } });
        return;
      }

      // Cria registro PENDING
      const notification = await tx.notification.create({
        data: {
          companyId: (parsed.companyId as string | undefined) ?? 'unknown',
          channel:   NotificationChannel.EMAIL,
          status:    'PENDING',
          recipient: emailOpts.to,
          subject:   emailOpts.subject,
          body:      emailOpts.html,
        },
      });

      // Registra evento como processado dentro da transacao
      await tx.processedEvent.create({ data: { id: eventId, eventType } });

      // Envio de e-mail fora da transacao (efeito colateral de I/O)
      try {
        await sendEmail(emailOpts);

        await prisma.notification.update({
          where: { id: notification.id },
          data:  { status: 'SENT', sentAt: new Date() },
        });

        notificationsSentTotal.inc({ channel: 'EMAIL', event_type: eventType, result: 'success' });
        eventsConsumedTotal.inc({ event_type: eventType, result: 'success' });

        logger.info(
          { event: 'notification_sent', notificationId: notification.id, eventId, eventType, to: emailOpts.to },
          'Notificacao enviada',
        );
      } catch (sendErr) {
        const errorMsg  = (sendErr as Error).message;
        const retryCount = notification.retryCount + 1;
        const shouldRetry = retryCount < env.maxRetryCount;

        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            status:     shouldRetry ? 'PENDING' : 'FAILED',
            errorMsg,
            retryCount,
          },
        });

        notificationsSentTotal.inc({ channel: 'EMAIL', event_type: eventType, result: 'error' });
        eventsConsumedTotal.inc({ event_type: eventType, result: 'error' });

        logger.error(
          { event: 'notification_failed', notificationId: notification.id, eventId, eventType, errorMsg, retryCount },
          'Falha ao enviar notificacao',
        );

        if (shouldRetry) {
          scheduleRetry(channel, msg, retryCount);
          notificationsRetryTotal.inc({ event_type: eventType });
        }
      }
    });
  } catch (txErr) {
    logger.error({ event: 'transaction_error', eventId, eventType, err: txErr }, 'Erro na transacao nack');
    channel.nack(msg, false, false);
    return;
  }

  channel.ack(msg);
}

// ─── Setup do consumer RabbitMQ ───────────────────────────────────────────────

let connection: amqplib.ChannelModel | null = null;
let consumerChannel: Channel | null = null;

const SUPPORTED_EVENTS = [
  'os.completed',
  'os.assigned',
  'os.cancelled',
  'stock.below_min',
  'invoice.overdue',
  'material_request.reviewed',
  'user.created',
];

export async function startConsumer(): Promise<void> {
  connection = await amqplib.connect(env.rabbitmqUrl);
  consumerChannel = await connection.createChannel();

  const ch = consumerChannel;

  await ch.assertExchange(env.rabbitmqExchange, 'topic', { durable: true });

  // Fila principal com DLX apontando para a fila de retry
  await ch.assertQueue(env.rabbitmqQueue, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange':    '',
      'x-dead-letter-routing-key': env.rabbitmqRetryQueue,
    },
  });

  // Fila de retry: mensagens expiram (TTL) e voltam para a fila principal via DLX
  await ch.assertQueue(env.rabbitmqRetryQueue, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange':    '',
      'x-dead-letter-routing-key': env.rabbitmqQueue,
    },
  });

  for (const eventType of SUPPORTED_EVENTS) {
    await ch.bindQueue(env.rabbitmqQueue, env.rabbitmqExchange, eventType);
  }

  ch.prefetch(env.rabbitmqPrefetch);

  await ch.consume(env.rabbitmqQueue, async (msg) => {
    if (!msg) return;
    await processMessage(ch, msg);
  });

  logger.info(
    { event: 'consumer_started', exchange: env.rabbitmqExchange, queue: env.rabbitmqQueue, events: SUPPORTED_EVENTS },
    'Consumer RabbitMQ iniciado',
  );

  connection.on('error', (err: Error) => {
    logger.error({ event: 'rabbitmq_connection_error', err }, 'Erro na conexao RabbitMQ');
  });

  connection.on('close', () => {
    logger.warn({ event: 'rabbitmq_connection_closed' }, 'Conexao RabbitMQ encerrada reconectando em 5s');
    setTimeout(() => {
      startConsumer().catch((e) =>
        logger.error({ event: 'rabbitmq_reconnect_error', err: e }, 'Falha ao reconectar ao RabbitMQ'),
      );
    }, 5_000);
  });
}

export async function stopConsumer(): Promise<void> {
  try {
    if (consumerChannel) await consumerChannel.close();
    if (connection)      await connection.close();
    logger.info({ event: 'consumer_stopped' }, 'Consumer RabbitMQ encerrado');
  } catch (err) {
    logger.error({ event: 'consumer_stop_error', err }, 'Erro ao encerrar consumer RabbitMQ');
  }
}
