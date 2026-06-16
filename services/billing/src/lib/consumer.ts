import amqplib, { Channel, ConsumeMessage } from 'amqplib';
import { env } from '../env';
import { amqpEventsTotal } from './metrics';
import { prisma } from './prisma';
import { publish } from './publisher';

// Payload esperado do evento os.completed (publicado pelo Service Order Service)
interface OsCompletedPayload {
  serviceOrderId: string;
  clientId:       string;
  clientName:     string;
  companyId:      string;
  items:          Array<{ description: string; qty: number; unitPrice: number }>;
}

let consumerConnection: amqplib.ChannelModel | null = null;
let consumerChannel:    Channel              | null = null;

async function handleOsCompleted(payload: OsCompletedPayload): Promise<void> {
  const { serviceOrderId, clientId, clientName, companyId, items } = payload;

  // Idempotência: não cria fatura duplicada para a mesma OS
  const existing = await prisma.invoice.findFirst({
    where: { serviceOrderId, companyId },
  });
  if (existing) {
    console.info(`[consumer] os.completed já processado para OS ${serviceOrderId}, ignorando`);
    return;
  }

  const subtotal = items.reduce((acc, i) => acc + i.qty * i.unitPrice, 0);

  await prisma.invoice.create({
    data: {
      companyId,
      serviceOrderId,
      clientId,
      clientName,
      subtotal,
      discount: 0,
      total:    subtotal,
      status:   'DRAFT',
      note:     `Fatura gerada automaticamente a partir da OS ${serviceOrderId}`,
    },
  });

  console.info(`[consumer] Fatura DRAFT criada para OS ${serviceOrderId}`);
}

async function dispatch(msg: ConsumeMessage, ch: Channel): Promise<void> {
  const routingKey = msg.fields.routingKey;
  try {
    const raw     = msg.content.toString();
    const payload = JSON.parse(raw) as Record<string, unknown>;

    if (routingKey === 'os.completed') {
      await handleOsCompleted(payload as unknown as OsCompletedPayload);
    } else {
      console.warn(`[consumer] routing key desconhecida: ${routingKey}`);
    }

    ch.ack(msg);
    amqpEventsTotal.inc({ direction: 'consume', routing_key: routingKey, result: 'ok' });
  } catch (err) {
    console.error(`[consumer] erro ao processar ${routingKey}:`, err);
    amqpEventsTotal.inc({ direction: 'consume', routing_key: routingKey, result: 'error' });
    // nack sem requeue para enviar para dead-letter (configure DLX no broker)
    ch.nack(msg, false, false);
  }
}

export async function startConsumer(): Promise<void> {
  consumerConnection = await amqplib.connect(env.rabbitmqUrl);
  consumerChannel    = await consumerConnection.createChannel();

  const { rabbitmqExchange, rabbitmqQueue } = env;

  await consumerChannel.assertExchange(rabbitmqExchange, 'topic', { durable: true });
  await consumerChannel.assertQueue(rabbitmqQueue, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': `${rabbitmqExchange}.dlx`,
    },
  });

  // Binding: consome apenas eventos relevantes para o billing
  await consumerChannel.bindQueue(rabbitmqQueue, rabbitmqExchange, 'os.completed');

  consumerChannel.prefetch(10);

  await consumerChannel.consume(rabbitmqQueue, (msg) => {
    if (!msg) return;
    dispatch(msg, consumerChannel!);
  });

  consumerConnection.on('error', (err) => {
    console.error('[consumer] conexão AMQP encerrada com erro:', err.message);
    consumerChannel    = null;
    consumerConnection = null;
  });

  console.info(`[consumer] ouvindo fila ${rabbitmqQueue} no exchange ${rabbitmqExchange}`);
}

export async function closeConsumer(): Promise<void> {
  try {
    await consumerChannel?.close();
    await consumerConnection?.close();
  } catch {
    // silencia erros no shutdown
  } finally {
    consumerChannel    = null;
    consumerConnection = null;
  }
}

// Re-exporta publish para uso interno do consumer (ex.: publicar eventos derivados)
export { publish };
