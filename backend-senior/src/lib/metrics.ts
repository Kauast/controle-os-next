import {
  Registry,
  collectDefaultMetrics,
  Histogram,
  Counter,
  Gauge,
} from 'prom-client';

// Regra 7: métricas de performance (tempo, memória, CPU).
export const registry = new Registry();
registry.setDefaultLabels({ service: 'controle-os-api' });

// process_cpu_*, nodejs_heap_*, nodejs_eventloop_lag, etc.
collectDefaultMetrics({ register: registry, prefix: 'app_' });

// Regra 1+7: duração de cada requisição HTTP, rotulada por rota/método/status.
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

// Regra 5: tempo de cada query no banco.
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duração das queries no banco em segundos',
  labelNames: ['model', 'action'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 3],
  registers: [registry],
});

// Regra 6: hit/miss de cache.
export const cacheOperations = new Counter({
  name: 'cache_operations_total',
  help: 'Operações de cache rotuladas por resultado (hit/miss)',
  labelNames: ['cache', 'result'],
  registers: [registry],
});

// Regra 4: saúde das dependências exposta como gauge (0 = down, 1 = up).
export const dependencyUp = new Gauge({
  name: 'dependency_up',
  help: 'Disponibilidade das dependências (1 = up, 0 = down)',
  labelNames: ['dependency'],
  registers: [registry],
});

// Fila de eventos (BullMQ).
export const queueJobsTotal = new Counter({
  name: 'queue_jobs_total',
  help: 'Total de jobs processados pela fila',
  labelNames: ['queue', 'job', 'result'],
  registers: [registry],
});

// Chamadas à API de IA (Anthropic Claude).
export const aiRequestDuration = new Histogram({
  name: 'ai_request_duration_seconds',
  help: 'Duração das chamadas à API de IA em segundos',
  labelNames: ['operation', 'outcome'],
  buckets: [0.5, 1, 2, 3, 5, 8, 13, 21],
  registers: [registry],
});

export const aiRequestsTotal = new Counter({
  name: 'ai_requests_total',
  help: 'Total de chamadas à API de IA rotuladas por resultado',
  labelNames: ['operation', 'outcome'],
  registers: [registry],
});

export const aiTokensTotal = new Counter({
  name: 'ai_tokens_total',
  help: 'Tokens consumidos pela API de IA',
  labelNames: ['operation', 'direction'],
  registers: [registry],
});

export async function metricsText(): Promise<string> {
  return registry.metrics();
}

export const metricsContentType = registry.contentType;
