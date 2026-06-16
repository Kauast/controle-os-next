import {
  Registry,
  collectDefaultMetrics,
  Histogram,
  Counter,
  Gauge,
} from 'prom-client';

export const registry = new Registry();
registry.setDefaultLabels({ service: 'notification-service' });

collectDefaultMetrics({ register: registry, prefix: 'app_' });

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duração das requisições HTTP em segundos',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total de requisições HTTP',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

export const dependencyUp = new Gauge({
  name: 'dependency_up',
  help: 'Disponibilidade das dependências (1 = up, 0 = down)',
  labelNames: ['dependency'],
  registers: [registry],
});

// Notificações enviadas por canal e resultado
export const notificationsSentTotal = new Counter({
  name: 'notifications_sent_total',
  help: 'Total de notificações processadas pelo canal e resultado',
  labelNames: ['channel', 'event_type', 'result'],
  registers: [registry],
});

// Eventos consumidos do RabbitMQ
export const eventsConsumedTotal = new Counter({
  name: 'events_consumed_total',
  help: 'Total de eventos consumidos do broker',
  labelNames: ['event_type', 'result'],
  registers: [registry],
});

// Tentativas de retry
export const notificationsRetryTotal = new Counter({
  name: 'notifications_retry_total',
  help: 'Total de notificações reenviadas por retry',
  labelNames: ['event_type'],
  registers: [registry],
});

export async function metricsText(): Promise<string> {
  return registry.metrics();
}

export const metricsContentType = registry.contentType;
