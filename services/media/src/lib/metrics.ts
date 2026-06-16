import {
  Registry,
  collectDefaultMetrics,
  Histogram,
  Counter,
  Gauge,
} from 'prom-client';

export const registry = new Registry();
registry.setDefaultLabels({ service: 'media-service' });

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

export const uploadBytesTotal = new Counter({
  name: 'media_upload_bytes_total',
  help: 'Total de bytes recebidos em uploads',
  labelNames: ['mime_type'],
  registers: [registry],
});

export const uploadTotal = new Counter({
  name: 'media_uploads_total',
  help: 'Total de uploads realizados',
  labelNames: ['mime_type', 'storage_provider'],
  registers: [registry],
});

export const storageOperationDuration = new Histogram({
  name: 'media_storage_operation_duration_seconds',
  help: 'Duração das operações de storage (upload/download/delete)',
  labelNames: ['operation', 'provider'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [registry],
});

export const dependencyUp = new Gauge({
  name: 'dependency_up',
  help: 'Disponibilidade das dependências (1 = up, 0 = down)',
  labelNames: ['dependency'],
  registers: [registry],
});

export async function metricsText(): Promise<string> {
  return registry.metrics();
}

export const metricsContentType = registry.contentType;
