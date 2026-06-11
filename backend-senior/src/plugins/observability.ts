import { FastifyInstance, FastifyRequest } from 'fastify';
import { httpRequestDuration, httpRequestsTotal } from '../lib/metrics';

// Rota normalizada para evitar explosão de cardinalidade nas métricas
// (ex.: /api/service-orders/abc123 vira /api/service-orders/:id).
function routeLabel(req: FastifyRequest): string {
  return req.routeOptions?.url ?? req.url.split('?')[0];
}

type Timed = FastifyRequest & { startTime?: bigint };

// Registra hooks de observabilidade na instância raiz (aplica-se a todas as rotas).
export function registerObservability(app: FastifyInstance) {
  // Regra 1: ecoa o Request ID em toda resposta para rastreabilidade ponta a ponta.
  app.addHook('onRequest', async (req, reply) => {
    reply.header('x-request-id', req.id);
    (req as Timed).startTime = process.hrtime.bigint();
  });

  // Regra 7: mede duração e contabiliza cada requisição.
  app.addHook('onResponse', async (req, reply) => {
    const start = (req as Timed).startTime;
    const seconds = start ? Number(process.hrtime.bigint() - start) / 1e9 : 0;
    const labels = {
      method: req.method,
      route: routeLabel(req),
      status_code: String(reply.statusCode),
    };
    httpRequestDuration.observe(labels, seconds);
    httpRequestsTotal.inc(labels);

    req.log.info(
      {
        event: 'http_response',
        reqId: req.id,
        method: req.method,
        route: routeLabel(req),
        statusCode: reply.statusCode,
        durationMs: Math.round(seconds * 1000 * 100) / 100,
        ip: req.ip,
      },
      'http_response'
    );
  });
}

// Regra 2: log de erro com stack trace completo e estruturado.
export function logRequestError(req: FastifyRequest, error: Error) {
  req.log.error(
    {
      event: 'request_error',
      reqId: req.id,
      route: routeLabel(req),
      method: req.method,
      errName: error.name,
      errMessage: error.message,
      stack: error.stack,
    },
    'request_error'
  );
}
