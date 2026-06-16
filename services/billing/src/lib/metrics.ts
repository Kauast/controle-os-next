import {
  Registry,
  collectDefaultMetrics,
  Histogram,
  Counter,
  Gauge,
} from 'prom-client';

export const registry = new Registry();
registry.setDefaultLabels({ service: 'billing-service' });

collectDefaultMetrics({ register: registry, prefix: 'billing_' });

export const httpRequestDuration = new Histogram({
  name: 'billing_http_request_duration_seconds',
  help: 'Duração das requisições HTTP do billing service',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const httpRequestsTotal = new Counter({
  name: 'billing_http_requests_total',
  help: 'Total de requisições HTTP do billing service',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

export const dbQueryDuration = new Histogram({
  name: 'billing_db_query_duration_seconds',
  help: 'Duração das queries no banco do billing service',
  labelNames: ['model', 'action'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 3],
  registers: [registry],
});

export const dependencyUp = new Gauge({
  name: 'billing_dependency_up',
  help: 'Disponibilidade das dependências (1=up, 0=down)',
  labelNames: ['dependency'],
  registers: [registry],
});

export const invoicesTotal = new Counter({
  name: 'billing_invoices_total',
  help: 'Total de faturas criadas/emitidas/canceladas',
  labelNames: ['event'],
  registers: [registry],
});

export const paymentsTotal = new Counter({
  name: 'billing_payments_total',
  help: 'Total de pagamentos confirmados/cancelados',
  labelNames: ['event', 'method'],
  registers: [registry],
});

export const amqpEventsTotal = new Counter({
  name: 'billing_amqp_events_total',
  help: 'Total de eventos AMQP publicados/consumidos',
  labelNames: ['direction', 'routing_key', 'result'],
  registers: [registry],
});

export async function metricsText(): Promise<string> {
  return registry.metrics();
}

export const metricsContentType = registry.contentType;
