import {
  Registry,
  collectDefaultMetrics,
  Histogram,
  Counter,
  Gauge,
} from 'prom-client';

export const registry = new Registry();
registry.setDefaultLabels({ service: 'identity-svc' });

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

export const authEventsTotal = new Counter({
  name: 'identity_auth_events_total',
  help: 'Total de eventos de autenticacao por tipo',
  labelNames: ['event'],
  registers: [registry],
});

export const dependencyUp = new Gauge({
  name: 'dependency_up',
  help: 'Disponibilidade das dependencias (1 = up, 0 = down)',
  labelNames: ['dependency'],
  registers: [registry],
});

export async function metricsText(): Promise<string> {
  return registry.metrics();
}

export const metricsContentType = registry.contentType;
