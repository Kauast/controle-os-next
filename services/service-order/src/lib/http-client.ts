import CircuitBreaker from 'opossum';
import { env } from '../env';
import { CircuitOpenError } from './errors';

interface RequestOptions {
  headers?: Record<string, string>;
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

function buildBreaker(name: string): CircuitBreaker<[string, RequestInit?], Response> {
  const fetchFn: FetchFn = fetch;

  const breaker = new CircuitBreaker<[string, RequestInit?], Response>(fetchFn, {
    name,
    timeout: env.cbTimeoutMs,
    errorThresholdPercentage: env.cbErrorThreshold,
    resetTimeout: env.cbResetTimeoutMs,
    // Considera erro qualquer resposta >= 500 ou timeout
    errorFilter: (err: Error) => {
      // Erros de rede são falhas; erros 4xx são falhas do cliente (não conta para CB)
      return err.message.includes('4');
    },
  });

  breaker.on('open',     () => console.warn(`[circuit-breaker] ${name} ABERTO`));
  breaker.on('halfOpen', () => console.info(`[circuit-breaker] ${name} HALF-OPEN — testando...`));
  breaker.on('close',    () => console.info(`[circuit-breaker] ${name} FECHADO — recuperado`));

  return breaker;
}

export interface ServiceClient {
  get<T = unknown>(path: string, opts?: RequestOptions): Promise<T>;
  post<T = unknown>(path: string, body: unknown, opts?: RequestOptions): Promise<T>;
  delete<T = unknown>(path: string, opts?: RequestOptions): Promise<T>;
}

export function createServiceClient(baseUrl: string, serviceName: string): ServiceClient {
  const breaker = buildBreaker(serviceName);

  async function request<T>(method: string, path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    const url = `${baseUrl}${path}`;
    const init: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...opts?.headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    };

    let response: Response;
    try {
      response = await breaker.fire(url, init);
    } catch (err: unknown) {
      if ((err as Error).message?.includes('Breaker is open')) {
        throw new CircuitOpenError(serviceName);
      }
      throw err;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const msg = `${serviceName} retornou ${response.status}: ${text}`;
      throw new Error(msg);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return response.json() as Promise<T>;
    }
    return response.text() as unknown as T;
  }

  return {
    get:    <T>(path: string, opts?: RequestOptions) => request<T>('GET',    path, undefined, opts),
    post:   <T>(path: string, body: unknown, opts?: RequestOptions) => request<T>('POST',   path, body, opts),
    delete: <T>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, undefined, opts),
  };
}

// Singletons por serviço — reutilizam o mesmo circuit breaker
export const customerClient  = createServiceClient(env.customerSvcUrl,  'customer-svc');
export const workforceClient = createServiceClient(env.workforceSvcUrl, 'workforce-svc');
export const inventoryClient = createServiceClient(env.inventorySvcUrl, 'inventory-svc');
export const chipClient      = createServiceClient(env.chipSvcUrl,      'chip-svc');
