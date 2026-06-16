import amqplib, { Channel, ConsumeMessage } from 'amqplib';
import { env } from '../env';
import { prisma } from './prisma';

const QUEUE_STOCK_RESERVED   = 'service-order.stock.reserved';
const QUEUE_PAYMENT_CONFIRMED = 'service-order.payment.confirmed';

let consumerConnection: amqplib.ChannelModel | null = null;
let consumerChannel: Channel | null = null;

type MessageHandler = (msg: ConsumeMessage, channel: Channel) => Promise<void>;

async function handleStockReserved(msg: ConsumeMessage, ch: Channel): Promise<void> {
  const payload = JSON.parse(msg.content.toString()) as {
    serviceOrderId: string;
    reservationId: string;
    productId: string;
    quantity: number;
  };

  // Registra o evento na OS para rastreabilidade — a saga síncrona já atualizou
  // os reservationIds, mas se houver confirmação assíncrona do inventory, persiste aqui.
  await prisma.serviceOrderEvent.create({
    data: {
      serviceOrderId: payload.serviceOrderId,
      type: 'stock.reserved',
      payload: payload as unknown as Record<string, unknown>,
    },
  });

  ch.ack(msg);
  console.info('[consumer] stock.reserved processado para OS:', payload.serviceOrderId);
}

async function handlePaymentConfirmed(msg: ConsumeMessage, ch: Channel): Promise<void> {
  const payload = JSON.parse(msg.content.toString()) as {
    serviceOrderId: string;
    paymentId: string;
    amount: number;
    confirmedAt: string;
  };

  await prisma.serviceOrderEvent.create({
    data: {
      serviceOrderId: payload.serviceOrderId,
      type: 'payment.confirmed',
      payload: payload as unknown as Record<string, unknown>,
    },
  });

  ch.ack(msg);
  console.info('[consumer] payment.confirmed processado para OS:', payload.serviceOrderId);
}

async function bindQueue(
  ch: Channel,
  queue: string,
  routingKey: string,
  handler: MessageHandler,
): Promise<void> {
  await ch.assertQueue(queue, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': env.rabbitmqDlq,
    },
  });
  await ch.bindQueue(queue, env.rabbitmqExchange, routingKey);

  ch.consume(queue, async (msg) => {
    if (!msg) return;
    try {
      await handler(msg, ch);
    } catch (err) {
      console.error('[consumer] Erro ao processar mensagem:', routingKey, (err as Error).message);
      // Rejeita e envia para DLQ após 1 retry
      ch.nack(msg, false, false);
    }
  });
}

export async function startConsumers(): Promise<void> {
  try {
    consumerConnection = await amqplib.connect(env.rabbitmqUrl);
    consumerChannel    = await consumerConnection.createChannel();

    await consumerChannel.assertExchange(env.rabbitmqExchange, 'topic', { durable: true });
    await consumerChannel.prefetch(10);

    await bindQueue(consumerChannel, QUEUE_STOCK_RESERVED,    'stock.reserved',    handleStockReserved);
    await bindQueue(consumerChannel, QUEUE_PAYMENT_CONFIRMED, 'payment.confirmed', handlePaymentConfirmed);

    console.info('[consumer] Consumidores iniciados');
  } catch (err) {
    console.error('[consumer] Falha ao iniciar consumidores:', (err as Error).message);
  }
}

export async function stopConsumers(): Promise<void> {
  try {
    await consumerChannel?.close();
    await consumerConnection?.close();
  } catch {
    // silencioso
  }
}
