import amqp, { Channel, ConsumeMessage } from 'amqplib';
import { env } from '../env';
import { amqpConsumedTotal } from './metrics';

type HandlerFn = (payload: Record<string, unknown>, routingKey: string) => Promise<void>;

interface ConsumerBinding {
  routingKey: string;
  handler: HandlerFn;
}

const QUEUE_NAME = 'inventory-service';
const bindings: ConsumerBinding[] = [];

let connection: amqp.ChannelModel | null = null;
let channel: Channel | null = null;
let reconnecting = false;

export function registerHandler(routingKey: string, handler: HandlerFn): void {
  bindings.push({ routingKey, handler });
}

async function connect(): Promise<void> {
  connection = await amqp.connect(env.RABBITMQ_URL);
  channel = await connection.createChannel();

  await channel.assertExchange(env.RABBITMQ_EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  channel.prefetch(env.RABBITMQ_PREFETCH);

  for (const { routingKey } of bindings) {
    await channel.bindQueue(QUEUE_NAME, env.RABBITMQ_EXCHANGE, routingKey);
  }

  await channel.consume(QUEUE_NAME, async (msg: ConsumeMessage | null) => {
    if (!msg) return;
    const routingKey = msg.fields.routingKey;

    try {
      const payload = JSON.parse(msg.content.toString()) as Record<string, unknown>;
      const binding = bindings.find((b) => matchRoutingKey(b.routingKey, routingKey));

      if (binding) {
        await binding.handler(payload, routingKey);
        channel?.ack(msg);
        amqpConsumedTotal.inc({ routing_key: routingKey, result: 'success' });
      } else {
        // Sem handler registrado — ack para evitar acumulo
        channel?.ack(msg);
        amqpConsumedTotal.inc({ routing_key: routingKey, result: 'no_handler' });
      }
    } catch (err) {
      console.error(`[consumer] Erro ao processar ${routingKey}:`, err);
      // nack sem requeue para evitar loop infinito — vai para dead letter se configurado
      channel?.nack(msg, false, false);
      amqpConsumedTotal.inc({ routing_key: routingKey, result: 'error' });
    }
  });

  connection.on('error', (err) => {
    console.error('[consumer] Conexao RabbitMQ perdida:', err.message);
    channel = null;
    connection = null;
    scheduleReconnect();
  });

  connection.on('close', () => {
    console.warn('[consumer] Conexao RabbitMQ fechada');
    channel = null;
    connection = null;
    scheduleReconnect();
  });

  console.info('[consumer] Conectado e consumindo mensagens');
}

function scheduleReconnect() {
  if (reconnecting) return;
  reconnecting = true;
  setTimeout(async () => {
    try {
      await connect();
      reconnecting = false;
    } catch (err) {
      console.error('[consumer] Falha ao reconectar:', err);
      reconnecting = false;
      scheduleReconnect();
    }
  }, 5000);
}

export async function startConsumer(): Promise<void> {
  await connect();
}

export async function closeConsumer(): Promise<void> {
  try {
    await channel?.close();
    await connection?.close();
  } catch {
    // ignorar erros no shutdown
  }
}

// Suporte simples a wildcards AMQP: * = uma palavra, # = zero ou mais palavras
function matchRoutingKey(pattern: string, key: string): boolean {
  const regexStr = pattern
    .replace(/\./g, '\.')
    .replace(/\*/g, '[^.]+')
    .replace(/#/g, '.*');
  return new RegExp(`^${regexStr}$`).test(key);
}
