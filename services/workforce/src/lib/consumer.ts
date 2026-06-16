import amqplib, { Channel, ConsumeMessage } from 'amqplib';
import pino from 'pino';
import { env } from '../env';
import { prisma } from './prisma';
import { amqpEventsTotal, dependencyUp } from './metrics';

const logger = pino({ level: env.LOG_LEVEL });

const EXCHANGE = 'identity.events';
const OS_EXCHANGE = 'serviceorder.events';
const QUEUE = 'workforce.consumer';

// Eventos consumidos e seus routing keys
const BINDINGS = [
  { exchange: EXCHANGE, routingKey: 'user.created' },
  { exchange: OS_EXCHANGE, routingKey: 'os.assigned' },
  { exchange: OS_EXCHANGE, routingKey: 'os.completed' },
  { exchange: OS_EXCHANGE, routingKey: 'os.cancelled' },
];

let connection: amqplib.ChannelModel | null = null;
let channel: Channel | null = null;

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleUserCreated(payload: Record<string, unknown>): Promise<void> {
  const { userId, name, email, role, companyId } = payload as {
    userId: string;
    name: string;
    email?: string;
    role: string;
    companyId: string;
  };

  if (role !== 'TECHNICIAN') return;

  const existing = await prisma.technician.findUnique({ where: { userId } });
  if (existing) {
    logger.warn({ userId }, 'user.created: technician already exists, skipping');
    return;
  }

  await prisma.technician.create({
    data: {
      companyId,
      userId,
      name,
      email: email ?? null,
      specialties: [],
    },
  });

  logger.info({ userId, companyId }, 'Technician auto-created from user.created event');
}

async function handleOsAssigned(payload: Record<string, unknown>): Promise<void> {
  const { technicianId } = payload as { technicianId: string };
  if (!technicianId) return;

  await prisma.technician.update({
    where: { id: technicianId },
    data: { currentOsCount: { increment: 1 }, status: 'BUSY' },
  });

  logger.info({ technicianId }, 'os.assigned: currentOsCount incremented');
}

async function handleOsCompleted(payload: Record<string, unknown>): Promise<void> {
  const { technicianId } = payload as { technicianId: string };
  if (!technicianId) return;

  const technician = await prisma.technician.findUnique({ where: { id: technicianId } });
  if (!technician) return;

  const newCount = Math.max(0, technician.currentOsCount - 1);
  const newStatus = newCount === 0 ? 'AVAILABLE' : technician.status;

  await prisma.technician.update({
    where: { id: technicianId },
    data: { currentOsCount: newCount, status: newStatus },
  });

  logger.info({ technicianId, newCount, newStatus }, 'os.completed: currentOsCount decremented');
}

async function handleOsCancelled(payload: Record<string, unknown>): Promise<void> {
  const { technicianId } = payload as { technicianId: string };
  if (!technicianId) return;

  const technician = await prisma.technician.findUnique({ where: { id: technicianId } });
  if (!technician) return;

  const newCount = Math.max(0, technician.currentOsCount - 1);
  const newStatus = newCount === 0 ? 'AVAILABLE' : technician.status;

  await prisma.technician.update({
    where: { id: technicianId },
    data: { currentOsCount: newCount, status: newStatus },
  });

  logger.info({ technicianId, newCount, newStatus }, 'os.cancelled: currentOsCount decremented');
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

async function dispatch(routingKey: string, payload: Record<string, unknown>): Promise<void> {
  switch (routingKey) {
    case 'user.created':
      await handleUserCreated(payload);
      break;
    case 'os.assigned':
      await handleOsAssigned(payload);
      break;
    case 'os.completed':
      await handleOsCompleted(payload);
      break;
    case 'os.cancelled':
      await handleOsCancelled(payload);
      break;
    default:
      logger.warn({ routingKey }, 'Unhandled routing key');
  }
}

// ─── Consumer lifecycle ───────────────────────────────────────────────────────

async function onMessage(msg: ConsumeMessage | null): Promise<void> {
  if (!msg) return;

  const routingKey = msg.fields.routingKey;
  let payload: Record<string, unknown> = {};

  try {
    payload = JSON.parse(msg.content.toString()) as Record<string, unknown>;
    await dispatch(routingKey, payload);
    channel?.ack(msg);
    amqpEventsTotal.inc({ event: routingKey, result: 'success' });
  } catch (err) {
    logger.error({ err, routingKey, payload }, 'Failed to process AMQP message');
    amqpEventsTotal.inc({ event: routingKey, result: 'error' });
    // nack sem requeue para evitar loop infinito; mensagem vai para DLQ se configurada
    channel?.nack(msg, false, false);
  }
}

export async function startConsumer(): Promise<void> {
  connection = await amqplib.connect(env.RABBITMQ_URL);
  channel = await connection.createChannel();
  channel.prefetch(10);

  // Declara exchanges e fila
  for (const { exchange } of BINDINGS) {
    await channel.assertExchange(exchange, 'topic', { durable: true });
  }

  await channel.assertQueue(QUEUE, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': `${QUEUE}.dlx`,
    },
  });

  // Dead-letter exchange
  await channel.assertExchange(`${QUEUE}.dlx`, 'topic', { durable: true });
  await channel.assertQueue(`${QUEUE}.dlq`, { durable: true });
  await channel.bindQueue(`${QUEUE}.dlq`, `${QUEUE}.dlx`, '#');

  // Bind fila aos eventos
  for (const { exchange, routingKey } of BINDINGS) {
    await channel.bindQueue(QUEUE, exchange, routingKey);
  }

  await channel.consume(QUEUE, onMessage);

  dependencyUp.set({ dependency: 'rabbitmq' }, 1);
  logger.info({ queue: QUEUE, bindings: BINDINGS }, 'AMQP consumer started');

  connection.on('error', (err) => {
    dependencyUp.set({ dependency: 'rabbitmq' }, 0);
    logger.error({ err }, 'AMQP connection error');
  });

  connection.on('close', () => {
    dependencyUp.set({ dependency: 'rabbitmq' }, 0);
    logger.warn('AMQP connection closed');
  });
}

export async function closeConsumer(): Promise<void> {
  await channel?.close();
  await connection?.close();
  channel = null;
  connection = null;
}
