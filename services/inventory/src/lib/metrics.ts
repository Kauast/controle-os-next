import {
  Registry,
  collectDefaultMetrics,
  Histogram,
  Counter,
  Gauge,
} from 'prom-client';

export const registry = new Registry();
registry.setDefaultLabels({ service: 'inventory-service' });

collectDefaultMetrics({ register: registry, prefix: 'app_' });

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duracao das requisicoes HTTP em segundos',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total de requisicoes HTTP',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duracao das queries no banco em segundos',
  labelNames: ['model', 'action'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 3],
  registers: [registry],
});

export const stockReservationTotal = new Counter({
  name: 'stock_reservation_total',
  help: 'Total de reservas de estoque por resultado',
  labelNames: ['result'],
  registers: [registry],
});

export const stockBelowMinGauge = new Gauge({
  name: 'stock_products_below_min_total',
  help: 'Produtos com saldo abaixo do minimo por empresa',
  labelNames: ['companyId'],
  registers: [registry],
});

export const dependencyUp = new Gauge({
  name: 'dependency_up',
  help: 'Disponibilidade das dependencias (1 = up, 0 = down)',
  labelNames: ['dependency'],
  registers: [registry],
});

export const amqpPublishedTotal = new Counter({
  name: 'amqp_published_total',
  help: 'Total de eventos publicados no RabbitMQ',
  labelNames: ['routing_key', 'result'],
  registers: [registry],
});

export const amqpConsumedTotal = new Counter({
  name: 'amqp_consumed_total',
  help: 'Total de eventos consumidos do RabbitMQ',
  labelNames: ['routing_key', 'result'],
  registers: [registry],
});

export async function metricsText(): Promise<string> {
  return registry.metrics();
}

export const metricsContentType = registry.contentType;
