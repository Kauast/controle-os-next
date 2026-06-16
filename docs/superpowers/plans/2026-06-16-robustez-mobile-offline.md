# Robustez Mobile/Offline do Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o backend resiliente a reenvios e edições offline do app de campo (Capacitor) sem duplicar dados nem sobrescrever estado mais novo, e tornar a fila offline do frontend durável e idempotente.

**Architecture:** Idempotência ponta-a-ponta via header `Idempotency-Key` persistido no Postgres (sobrevive restart); optimistic concurrency exposta ao cliente via `expectedVersion`; endpoint de sync em lote que reaproveita os services existentes; fila offline do frontend migrada de `localStorage` para IndexedDB com backoff exponencial e tratamento de conflito 409.

**Tech Stack:** Fastify 5, Prisma 6 + PostgreSQL, Zod 4, Vitest + Supertest (backend); Next.js 15, IndexedDB via `idb`, Capacitor Network (frontend).

---

## Contexto verificado do código (não re-investigar)

- `ServiceOrder` já tem `version Int @default(1)` (`backend-senior/prisma/schema.prisma:408`).
- `updateStatus`/`assign` já fazem optimistic lock **interno** (`updateMany where version: os.version` + `version: { increment: 1 }`, `service-order.service.ts:191`, `:278`) e lançam `ConcurrencyError` se `count===0`. **Mas** o cliente nunca informa a versão que viu — então edição offline obsoleta ainda passa (o servidor re-lê a versão atual).
- `updateExecution` (`service-order.service.ts:309`) **não** toca em `version` nem checa concorrência.
- `ConcurrencyError`/`ConflictError` já existem em `src/shared/errors.ts`. O handler em `app.ts:75` trata `lib/errors.AppError` (classe diferente da `shared/errors.AppError`), mas o fallback `error.statusCode ?? 500` ainda devolve 409 corretamente — apenas o campo `code` se perde. Tarefa 0 corrige isso.
- Não existe nenhuma idempotência hoje (`grep idempot` → 0 ocorrências).
- A fila offline do frontend (`src/lib/mobile/offline-queue.ts`) usa `localStorage`, sincroniza 1-a-1 via `client.patch`, sem backoff, sem header de idempotência, sem tratar 409.
- O proxy `src/app/api/backend/[...path]/route.ts:60` monta `headers` **só com Authorization** — não repassa `Idempotency-Key` nem `If-Match`. `ALLOWED_PREFIXES` (`:7`) não inclui `sync`.
- Schemas em `src/modules/service-order/service-order.rules.ts`; controller em `src/controllers/serviceOrderController.ts`; rotas em `src/routes/serviceOrderRoutes.ts`.

## Estrutura de arquivos

**Backend (`backend-senior/`)**
- Criar: `src/plugins/idempotency.ts` — plugin Fastify (preHandler + onSend) de idempotência.
- Criar: `src/modules/sync/sync.service.ts` — orquestra ações em lote reusando `ServiceOrderService`.
- Criar: `src/controllers/syncController.ts` e `src/routes/syncRoutes.ts`.
- Criar: `tests/idempotency.test.ts`, `tests/syncBatch.test.ts`, `tests/concurrency.test.ts`.
- Modificar: `prisma/schema.prisma` (modelo `IdempotencyKey`), `src/app.ts` (registrar plugin + rota sync), `src/modules/service-order/service-order.rules.ts` (campo `expectedVersion`), `src/modules/service-order/service-order.service.ts` (checagem `expectedVersion` em `updateStatus`/`updateExecution`/`assign`), `src/lib/errors.ts` ↔ unificar com `shared/errors.ts`.

**Frontend (`src/`)**
- Modificar: `src/app/api/backend/[...path]/route.ts` (repassar headers + prefixo `sync`).
- Reescrever: `src/lib/mobile/offline-queue.ts` (IndexedDB + idempotência + backoff + conflito).
- Criar: `src/lib/mobile/offline-db.ts` (wrapper IndexedDB com `idb`).
- Criar: `src/lib/mobile/__tests__/offline-queue.test.ts`.

---

## Task 0: Unificar AppError e expor `code` no error handler

**Files:**
- Modify: `backend-senior/src/lib/errors.ts`
- Modify: `backend-senior/src/app.ts:75-89`
- Test: `backend-senior/tests/security.test.ts` (reaproveita harness; adicionar caso)

- [ ] **Step 1: Escrever o teste que falha**

Adicionar em `backend-senior/tests/concurrency.test.ts` (novo arquivo, será expandido na Task 2):

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
afterAll(async () => { await app.close(); });

describe('error handler', () => {
  it('inclui o campo code em erros de domínio', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/service-orders/inexistente' });
    // sem auth retorna 401 com code UNAUTHORIZED
    expect(res.statusCode).toBe(401);
    expect(res.json()).toHaveProperty('code');
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd backend-senior && npx vitest run tests/concurrency.test.ts -t "code"`
Expected: FAIL — resposta não tem `code`.

- [ ] **Step 3: Unificar AppError**

Substituir todo o conteúdo de `backend-senior/src/lib/errors.ts` por um re-export do módulo rico (fonte única da verdade):

```ts
// Fonte única de erros de domínio. Mantém compat com imports legados de './lib/errors'.
export * from '../shared/errors';
```

- [ ] **Step 4: Propagar `code` no handler**

Em `backend-senior/src/app.ts`, no `setErrorHandler` (linhas 81-88), incluir `code`:

```ts
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.message, code: error.code, reqId: request.id });
    }
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      error: statusCode === 500 ? 'Erro interno do servidor' : error.message,
      code: (error as { code?: string }).code,
      reqId: request.id,
    });
```

(O import `import { AppError } from './lib/errors';` agora resolve para a classe de `shared/errors`, que tem `code`.)

- [ ] **Step 5: Rodar testes e ver passar**

Run: `cd backend-senior && npx vitest run tests/concurrency.test.ts -t "code"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend-senior/src/lib/errors.ts backend-senior/src/app.ts backend-senior/tests/concurrency.test.ts
git commit -m "fix(errors): unifica AppError e expõe code no error handler"
```

---

## Task 1: Modelo IdempotencyKey + migration

**Files:**
- Modify: `backend-senior/prisma/schema.prisma`
- Migration: `backend-senior/prisma/migrations/<timestamp>_idempotency_key/migration.sql` (gerada)

- [ ] **Step 1: Adicionar o modelo ao schema**

Acrescentar ao final de `backend-senior/prisma/schema.prisma`:

```prisma
model IdempotencyKey {
  id           String   @id @default(cuid())
  companyId    String
  key          String
  method       String
  path         String
  requestHash  String
  statusCode   Int
  responseBody Json
  createdAt    DateTime @default(now())
  expiresAt    DateTime

  @@unique([companyId, key])
  @@index([expiresAt])
}
```

- [ ] **Step 2: Gerar a migration**

Run: `cd backend-senior && npx prisma migrate dev --name idempotency_key`
Expected: cria `prisma/migrations/<ts>_idempotency_key/migration.sql` e regenera o client sem erro.

- [ ] **Step 3: Verificar o client gerado**

Run: `cd backend-senior && npx prisma generate && npx tsc --noEmit`
Expected: sem erros de tipo; `prisma.idempotencyKey` disponível.

- [ ] **Step 4: Commit**

```bash
git add backend-senior/prisma/schema.prisma backend-senior/prisma/migrations
git commit -m "feat(db): modelo IdempotencyKey para idempotência de mutações"
```

---

## Task 2: Checagem de `expectedVersion` (optimistic concurrency do cliente)

**Files:**
- Modify: `backend-senior/src/modules/service-order/service-order.rules.ts:58-83`
- Modify: `backend-senior/src/modules/service-order/service-order.service.ts:138-202` e `:309-368`
- Test: `backend-senior/tests/concurrency.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar a `backend-senior/tests/concurrency.test.ts` (precisa de helper de login/seed; reusar o padrão de `tests/serviceOrder.test.ts`):

```ts
describe('optimistic concurrency via expectedVersion', () => {
  it('rejeita updateStatus com expectedVersion obsoleta (409 CONCURRENCY_CONFLICT)', async () => {
    const { token, osId } = await seedOpenOS(app); // helper do harness existente
    // primeira mudança: OPEN -> IN_PROGRESS (version vai de 1 p/ 2)
    await app.inject({
      method: 'PATCH', url: `/api/service-orders/${osId}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'IN_PROGRESS', expectedVersion: 1 },
    });
    // segunda chamada com versão obsoleta (1) deve falhar
    const stale = await app.inject({
      method: 'PATCH', url: `/api/service-orders/${osId}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'WAITING_PARTS', expectedVersion: 1 },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().code).toBe('CONCURRENCY_CONFLICT');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend-senior && npx vitest run tests/concurrency.test.ts -t "expectedVersion"`
Expected: FAIL — hoje a segunda chamada retorna 200 (servidor re-lê a versão atual).

- [ ] **Step 3: Adicionar `expectedVersion` aos schemas**

Em `backend-senior/src/modules/service-order/service-order.rules.ts`, acrescentar o campo aos três schemas:

```ts
export const updateStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  cancellationReason: z.string().min(3).optional(),
  note: z.string().optional(),
  expectedVersion: z.number().int().positive().optional(),
});

export const updateExecutionSchema = z.object({
  checkinAt: z.string().datetime().optional(),
  checkoutAt: z.string().datetime().optional(),
  checkinLocation: z.string().optional(),
  checkinLat: z.number().optional(),
  checkinLng: z.number().optional(),
  checkoutLat: z.number().optional(),
  checkoutLng: z.number().optional(),
  workDoneNotes: z.string().optional(),
  chipIccid: z.string()
    .refine((v) => /\d{5,}/.test(v.replace(/\D/g, '')), {
      message: 'ICCID deve conter ao menos 5 dígitos numéricos',
    })
    .optional(),
  photoUrls: z.array(z.string().url()).optional(),
  clientSignature: z.string().optional(),
  photoAttachmentIds: z.array(z.string().min(1)).optional(),
  signatureAttachmentId: z.string().min(1).optional(),
  expectedVersion: z.number().int().positive().optional(),
});

export const assignSchema = z.object({
  technicianId: z.string().min(1).nullable().optional(),
  teamId: z.string().min(1).nullable().optional(),
  expectedVersion: z.number().int().positive().optional(),
});
```

- [ ] **Step 4: Checar versão em `updateStatus`**

Em `service-order.service.ts`, logo após `if (!os) throw new NotFoundError('OS');` (linha 144), inserir:

```ts
      if (input.expectedVersion !== undefined && input.expectedVersion !== os.version) {
        throw new ConcurrencyError();
      }
```

(O `updateMany where version: os.version` existente — linha 191 — continua protegendo contra corrida server-side.)

- [ ] **Step 5: Checar versão e incrementar em `updateExecution`**

Em `updateExecution` (linha 312, após o `if (!os)`), inserir a mesma checagem **e** passar a versionar a OS quando a execução muda, para que reenvios obsoletos sejam barrados. Substituir o bloco do `chipIccid` (linhas 343-345) e adicionar bump de versão guardado:

```ts
      if (data.expectedVersion !== undefined && data.expectedVersion !== os.version) {
        throw new ConcurrencyError();
      }
```

E, antes do `return tx.serviceOrder.findFirst(...)` (linha 363), incrementar a versão com guard:

```ts
      const bumped = await tx.serviceOrder.updateMany({
        where: { id, companyId: user.companyId, version: os.version },
        data: {
          ...(data.chipIccid !== undefined ? { chipIccid: data.chipIccid } : {}),
          version: { increment: 1 },
        },
      });
      if (bumped.count === 0) throw new ConcurrencyError();
```

Remover o `tx.serviceOrder.update({ where: { id }, data: { chipIccid } })` antigo das linhas 343-345 (agora coberto acima).

- [ ] **Step 6: Checar versão em `assign`**

Em `assign` (após o `findFirst` de `os`, ~linha 275), inserir antes do `updateMany`:

```ts
      if (input.expectedVersion !== undefined && input.expectedVersion !== os.version) {
        throw new ConcurrencyError();
      }
```

- [ ] **Step 7: Rodar e ver passar**

Run: `cd backend-senior && npx vitest run tests/concurrency.test.ts`
Expected: PASS (todos).

- [ ] **Step 8: Garantir não-regressão**

Run: `cd backend-senior && npx vitest run tests/serviceOrder.test.ts tests/serviceOrderRules.test.ts`
Expected: PASS — chamadas sem `expectedVersion` continuam funcionando (campo opcional).

- [ ] **Step 9: Commit**

```bash
git add backend-senior/src/modules/service-order backend-senior/tests/concurrency.test.ts
git commit -m "feat(os): expectedVersion para concorrência otimista cliente-servidor"
```

---

## Task 3: Plugin de idempotência

**Files:**
- Create: `backend-senior/src/plugins/idempotency.ts`
- Modify: `backend-senior/src/app.ts` (registrar + marcar rotas mutáveis)
- Test: `backend-senior/tests/idempotency.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `backend-senior/tests/idempotency.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { seedOpenOS, loginToken } from './helpers'; // padronizar helpers do harness

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
afterAll(async () => { await app.close(); });

describe('Idempotency-Key', () => {
  it('reenvio com a mesma chave não aplica a ação duas vezes', async () => {
    const { token, osId } = await seedOpenOS(app);
    const key = 'idem-test-1';
    const headers = { authorization: `Bearer ${token}`, 'idempotency-key': key };
    const payload = { status: 'IN_PROGRESS' };

    const first = await app.inject({ method: 'PATCH', url: `/api/service-orders/${osId}/status`, headers, payload });
    const second = await app.inject({ method: 'PATCH', url: `/api/service-orders/${osId}/status`, headers, payload });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    // a segunda é resposta cacheada: corpo idêntico, versão não incrementa de novo
    expect(second.json().version).toBe(first.json().version);
  });

  it('mesma chave com payload diferente retorna 422', async () => {
    const { token, osId } = await seedOpenOS(app);
    const key = 'idem-test-2';
    const headers = { authorization: `Bearer ${token}`, 'idempotency-key': key };
    await app.inject({ method: 'PATCH', url: `/api/service-orders/${osId}/status`, headers, payload: { status: 'IN_PROGRESS' } });
    const conflict = await app.inject({ method: 'PATCH', url: `/api/service-orders/${osId}/status`, headers, payload: { status: 'CANCELLED', cancellationReason: 'x' } });
    expect(conflict.statusCode).toBe(422);
    expect(conflict.json().code).toBe('IDEMPOTENCY_KEY_REUSE');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend-senior && npx vitest run tests/idempotency.test.ts`
Expected: FAIL — segunda chamada incrementa versão (sem idempotência).

- [ ] **Step 3: Implementar o plugin**

Criar `backend-senior/src/plugins/idempotency.ts`:

```ts
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createHash } from 'crypto';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

function hashRequest(req: FastifyRequest): string {
  const raw = JSON.stringify({ url: req.url, body: req.body ?? null });
  return createHash('sha256').update(raw).digest('hex');
}

declare module 'fastify' {
  interface FastifyRequest { _idem?: { key: string; companyId: string; requestHash: string } }
}

export function registerIdempotency(app: FastifyInstance): void {
  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    const key = req.headers['idempotency-key'] as string | undefined;
    if (!key || !MUTATING.has(req.method)) return;

    const user = req.user as { companyId?: string } | undefined;
    const companyId = user?.companyId ?? 'anon';
    const requestHash = hashRequest(req);

    const existing = await prisma.idempotencyKey.findUnique({
      where: { companyId_key: { companyId, key } },
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new AppError('Idempotency-Key reutilizada com payload diferente', 422, 'IDEMPOTENCY_KEY_REUSE');
      }
      reply.header('idempotent-replayed', 'true');
      return reply.status(existing.statusCode).send(existing.responseBody);
    }

    req._idem = { key, companyId, requestHash };
  });

  app.addHook('onSend', async (req: FastifyRequest, reply: FastifyReply, payload: unknown) => {
    const idem = req._idem;
    // só persiste respostas finais bem-sucedidas (2xx); erros podem ser reprocessados
    if (!idem || reply.statusCode >= 300) return payload;
    const body = typeof payload === 'string' ? safeParse(payload) : payload;
    try {
      await prisma.idempotencyKey.create({
        data: {
          companyId: idem.companyId,
          key: idem.key,
          method: req.method,
          path: req.url,
          requestHash: idem.requestHash,
          statusCode: reply.statusCode,
          responseBody: body as object,
          expiresAt: new Date(Date.now() + TTL_MS),
        },
      });
    } catch {
      // corrida: outra requisição com a mesma chave já persistiu — ignora.
    }
    return payload;
  });
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}
```

- [ ] **Step 4: Registrar o plugin**

Em `backend-senior/src/app.ts`, importar e registrar **após** o registro do `jwt` e **antes** das rotas (para que `req.user` esteja decodificado nas rotas autenticadas; como o `authenticate` roda em `onRequest` e o plugin em `preHandler`, `req.user` já existe):

```ts
import { registerIdempotency } from './plugins/idempotency';
// ... após await app.register(jwt, {...}); e antes dos app.register(...Routes):
registerIdempotency(app);
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend-senior && npx vitest run tests/idempotency.test.ts`
Expected: PASS (ambos os casos).

- [ ] **Step 6: Job de limpeza de chaves expiradas**

Adicionar ao `backend-senior/src/jobs/queue.ts` um repeatable job (seguir o padrão de jobs já existentes no arquivo) que execute:

```ts
await prisma.idempotencyKey.deleteMany({ where: { expiresAt: { lt: new Date() } } });
```

agendado a cada 1 hora.

- [ ] **Step 7: Commit**

```bash
git add backend-senior/src/plugins/idempotency.ts backend-senior/src/app.ts backend-senior/src/jobs/queue.ts backend-senior/tests/idempotency.test.ts
git commit -m "feat(api): idempotência via Idempotency-Key persistida em Postgres"
```

---

## Task 4: Endpoint de sync em lote

**Files:**
- Create: `backend-senior/src/modules/sync/sync.service.ts`
- Create: `backend-senior/src/controllers/syncController.ts`
- Create: `backend-senior/src/routes/syncRoutes.ts`
- Modify: `backend-senior/src/app.ts` (registrar rota)
- Test: `backend-senior/tests/syncBatch.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `backend-senior/tests/syncBatch.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { seedOpenOS } from './helpers';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
afterAll(async () => { await app.close(); });

describe('POST /api/sync/batch', () => {
  it('processa ações e retorna status por item', async () => {
    const { token, osId } = await seedOpenOS(app);
    const res = await app.inject({
      method: 'POST', url: '/api/sync/batch',
      headers: { authorization: `Bearer ${token}` },
      payload: { actions: [
        { clientActionId: 'a1', type: 'UPDATE_STATUS', serviceOrderId: osId, payload: { status: 'IN_PROGRESS' }, expectedVersion: 1 },
        { clientActionId: 'a2', type: 'UPDATE_STATUS', serviceOrderId: osId, payload: { status: 'IN_PROGRESS' }, expectedVersion: 1 },
      ] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.results[0]).toMatchObject({ clientActionId: 'a1', status: 'ok' });
    // a2 usa versão obsoleta (já foi p/ 2) -> conflito, sem derrubar o lote
    expect(body.results[1]).toMatchObject({ clientActionId: 'a2', status: 'conflict' });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend-senior && npx vitest run tests/syncBatch.test.ts`
Expected: FAIL — rota 404 (não existe).

- [ ] **Step 3: Implementar o sync service**

Criar `backend-senior/src/modules/sync/sync.service.ts`:

```ts
import { z } from 'zod';
import { ServiceOrderService } from '../service-order/service-order.service';
import { updateStatusSchema, updateExecutionSchema } from '../service-order/service-order.rules';
import { AppError } from '../../lib/errors';

interface RequestUser { id: string; role: string; companyId: string }

export const syncActionSchema = z.object({
  clientActionId: z.string().min(1),
  type: z.enum(['UPDATE_STATUS', 'UPDATE_EXECUTION']),
  serviceOrderId: z.string().min(1),
  payload: z.record(z.unknown()),
  expectedVersion: z.number().int().positive().optional(),
});

export const syncBatchSchema = z.object({
  actions: z.array(syncActionSchema).min(1).max(50),
});

export type SyncResult = {
  clientActionId: string;
  status: 'ok' | 'conflict' | 'error';
  data?: unknown;
  error?: string;
  code?: string;
};

const osService = new ServiceOrderService();

export class SyncService {
  async processBatch(actions: z.infer<typeof syncActionSchema>[], user: RequestUser): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    for (const action of actions) {
      try {
        const merged = { ...action.payload, expectedVersion: action.expectedVersion };
        let data: unknown;
        if (action.type === 'UPDATE_STATUS') {
          data = await osService.updateStatus(action.serviceOrderId, updateStatusSchema.parse(merged), user);
        } else {
          data = await osService.updateExecution(action.serviceOrderId, updateExecutionSchema.parse(merged), user);
        }
        results.push({ clientActionId: action.clientActionId, status: 'ok', data });
      } catch (err) {
        const isConflict = err instanceof AppError && err.statusCode === 409;
        results.push({
          clientActionId: action.clientActionId,
          status: isConflict ? 'conflict' : 'error',
          error: err instanceof Error ? err.message : 'Erro desconhecido',
          code: err instanceof AppError ? err.code : undefined,
        });
      }
    }
    return results;
  }
}
```

- [ ] **Step 4: Implementar controller e rota**

Criar `backend-senior/src/controllers/syncController.ts`:

```ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { SyncService, syncBatchSchema } from '../modules/sync/sync.service';

const service = new SyncService();

export class SyncController {
  async batch(request: FastifyRequest, reply: FastifyReply) {
    const { actions } = syncBatchSchema.parse(request.body);
    const user = request.user as { id: string; role: string; companyId: string };
    const results = await service.processBatch(actions, user);
    return reply.send({ results });
  }
}
```

Criar `backend-senior/src/routes/syncRoutes.ts`:

```ts
import { FastifyInstance } from 'fastify';
import { SyncController } from '../controllers/syncController';
import { authenticate } from '../middlewares/auth';

const controller = new SyncController();

export default async function syncRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);
  app.post('/batch', controller.batch.bind(controller));
}
```

- [ ] **Step 5: Registrar a rota**

Em `backend-senior/src/app.ts`, junto aos demais `app.register`:

```ts
import syncRoutes from './routes/syncRoutes';
// ...
await app.register(syncRoutes, { prefix: '/api/sync' });
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd backend-senior && npx vitest run tests/syncBatch.test.ts`
Expected: PASS — `a1` ok, `a2` conflict.

- [ ] **Step 7: Commit**

```bash
git add backend-senior/src/modules/sync backend-senior/src/controllers/syncController.ts backend-senior/src/routes/syncRoutes.ts backend-senior/src/app.ts backend-senior/tests/syncBatch.test.ts
git commit -m "feat(sync): endpoint POST /api/sync/batch idempotente e tolerante a conflito"
```

---

## Task 5: Proxy frontend repassa headers de idempotência/versão e libera prefixo sync

**Files:**
- Modify: `src/app/api/backend/[...path]/route.ts:7-22` e `:60-61`

- [ ] **Step 1: Liberar o prefixo `sync`**

Em `ALLOWED_PREFIXES` (`src/app/api/backend/[...path]/route.ts:7`), adicionar `"sync",` à lista.

- [ ] **Step 2: Repassar headers seguros para o backend**

Logo após `if (token) headers["Authorization"] = ...;` (linha 61), acrescentar:

```ts
  const FORWARD_HEADERS = ["idempotency-key", "if-match", "x-request-id"];
  for (const h of FORWARD_HEADERS) {
    const v = request.headers.get(h);
    if (v) headers[h] = v;
  }
```

- [ ] **Step 3: Verificar build de tipos**

Run: `cd /c/Users/kauamiranda/Documents/controle-os-next && npx tsc --noEmit -p tsconfig.json`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/backend/[...path]/route.ts"
git commit -m "feat(proxy): repassa Idempotency-Key/If-Match e libera prefixo sync"
```

---

## Task 6: Fila offline com IndexedDB, idempotência, backoff e conflito

**Files:**
- Create: `src/lib/mobile/offline-db.ts`
- Rewrite: `src/lib/mobile/offline-queue.ts`
- Create: `src/lib/mobile/__tests__/offline-queue.test.ts`
- Modify: `package.json` (devDeps de teste, se ausentes)

- [ ] **Step 1: Instalar dependências**

Run: `cd /c/Users/kauamiranda/Documents/controle-os-next && npm i idb && npm i -D vitest fake-indexeddb`
Expected: `idb` em dependencies; `vitest`/`fake-indexeddb` em devDependencies.

- [ ] **Step 2: Escrever o teste que falha**

Criar `src/lib/mobile/__tests__/offline-queue.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { enqueue, getQueue, syncQueue, getPendingCount } from '../offline-queue';
import { clearAll } from '../offline-db';

beforeEach(async () => { await clearAll(); });

describe('offline-queue (IndexedDB)', () => {
  it('enfileira e persiste ações', async () => {
    await enqueue({ serviceOrderId: 'os1', type: 'UPDATE_STATUS', payload: { status: 'IN_PROGRESS' }, expectedVersion: 1 });
    expect(await getPendingCount()).toBe(1);
  });

  it('envia Idempotency-Key e marca done em sucesso', async () => {
    await enqueue({ serviceOrderId: 'os1', type: 'UPDATE_STATUS', payload: { status: 'IN_PROGRESS' }, expectedVersion: 1 });
    const seen: { headers: Record<string, string> }[] = [];
    const client = {
      patch: async (_url: string, _data: unknown, opts?: { headers?: Record<string, string> }) => {
        seen.push({ headers: opts?.headers ?? {} });
        return { ok: true };
      },
    };
    const r = await syncQueue(client);
    expect(r.synced).toBe(1);
    expect(seen[0].headers['Idempotency-Key']).toBeTruthy();
    expect((await getQueue()).every((a) => a.status === 'done')).toBe(true);
  });

  it('marca conflict em 409 e não reenvia automaticamente', async () => {
    await enqueue({ serviceOrderId: 'os1', type: 'UPDATE_STATUS', payload: { status: 'IN_PROGRESS' }, expectedVersion: 1 });
    const client = {
      patch: async () => { const e: any = new Error('conflito'); e.status = 409; throw e; },
    };
    const r = await syncQueue(client);
    expect(r.conflicts).toBe(1);
    expect((await getQueue())[0].status).toBe('conflict');
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd /c/Users/kauamiranda/Documents/controle-os-next && npx vitest run src/lib/mobile/__tests__/offline-queue.test.ts`
Expected: FAIL — `offline-db` não existe e a API atual não tem `conflicts`/`clearAll`/`expectedVersion`.

- [ ] **Step 4: Implementar o wrapper IndexedDB**

Criar `src/lib/mobile/offline-db.ts`:

```ts
import { openDB, type IDBPDatabase } from "idb";

export interface QueueAction {
  id: string;
  serviceOrderId: string;
  type: "CHECKIN" | "UPDATE_EXECUTION" | "UPDATE_STATUS" | "COMPLETE_OS";
  payload: Record<string, unknown>;
  expectedVersion?: number;
  status: "pending" | "syncing" | "done" | "error" | "conflict";
  retryCount: number;
  nextAttemptAt: number;
  createdAt: string;
  error?: string;
}

const DB_NAME = "controle_os_offline";
const STORE = "queue";
let dbPromise: Promise<IDBPDatabase> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) {
          d.createObjectStore(STORE, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function putAction(a: QueueAction): Promise<void> {
  (await db()).put(STORE, a);
}
export async function allActions(): Promise<QueueAction[]> {
  return (await db()).getAll(STORE);
}
export async function clearAll(): Promise<void> {
  await (await db()).clear(STORE);
}
```

- [ ] **Step 5: Reescrever a fila offline**

Substituir todo o conteúdo de `src/lib/mobile/offline-queue.ts`:

```ts
import { putAction, allActions, type QueueAction } from "./offline-db";

export type QueueActionType = QueueAction["type"];
export type { QueueAction };

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

function backoff(retry: number): number {
  const exp = BASE_DELAY_MS * 2 ** retry;
  const jitter = Math.random() * 0.3 * exp;
  return Math.min(exp + jitter, 60_000);
}

export async function enqueue(
  action: Pick<QueueAction, "serviceOrderId" | "type" | "payload" | "expectedVersion">
): Promise<void> {
  await putAction({
    ...action,
    id: crypto.randomUUID(),
    status: "pending",
    retryCount: 0,
    nextAttemptAt: Date.now(),
    createdAt: new Date().toISOString(),
  });
}

export async function getQueue(): Promise<QueueAction[]> {
  return allActions();
}

export async function getPendingCount(): Promise<number> {
  return (await allActions()).filter(
    (a) => a.status === "pending" || a.status === "syncing"
  ).length;
}

interface HttpClient {
  patch: (
    url: string,
    data: unknown,
    opts?: { headers?: Record<string, string> }
  ) => Promise<unknown>;
}

async function executeAction(action: QueueAction, client: HttpClient): Promise<void> {
  const { serviceOrderId, type, payload, expectedVersion, id } = action;
  const body = expectedVersion !== undefined ? { ...payload, expectedVersion } : payload;
  const headers = { "Idempotency-Key": id };
  const url =
    type === "UPDATE_STATUS" || type === "COMPLETE_OS"
      ? `/service-orders/${serviceOrderId}/status`
      : `/service-orders/${serviceOrderId}/execution`;
  await client.patch(url, body, { headers });
}

export async function syncQueue(
  client: HttpClient,
  onProgress?: (done: number, total: number) => void
): Promise<{ synced: number; failed: number; conflicts: number }> {
  const now = Date.now();
  const queue = await allActions();
  const pending = queue.filter(
    (a) =>
      (a.status === "pending" || (a.status === "error" && a.retryCount < MAX_RETRIES)) &&
      a.nextAttemptAt <= now
  );

  let synced = 0, failed = 0, conflicts = 0;

  for (const action of pending) {
    action.status = "syncing";
    await putAction(action);
    try {
      await executeAction(action, client);
      action.status = "done";
      synced++;
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 409) {
        action.status = "conflict";
        action.error = "Conflito de versão — recarregue a OS";
        conflicts++;
      } else {
        action.retryCount++;
        action.status = action.retryCount >= MAX_RETRIES ? "error" : "pending";
        action.nextAttemptAt = now + backoff(action.retryCount);
        action.error = err instanceof Error ? err.message : "Erro desconhecido";
        failed++;
      }
    }
    await putAction(action);
    onProgress?.(synced + failed + conflicts, pending.length);
  }

  return { synced, failed, conflicts };
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd /c/Users/kauamiranda/Documents/controle-os-next && npx vitest run src/lib/mobile/__tests__/offline-queue.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 7: Atualizar os chamadores para a API async**

`enqueue`/`getQueue`/`getPendingCount`/`syncQueue` agora são `Promise`. Localizar os usos e adicionar `await`:

Run: `cd /c/Users/kauamiranda/Documents/controle-os-next && npx grep -rn "enqueue(\|getQueue(\|getPendingCount(\|syncQueue(" src/hooks src/app src/components 2>/dev/null` (ou usar a busca da IDE)
Ajustar cada chamada (ex.: em `src/hooks/useServiceOrdersMobile.ts`) para `await` dentro de funções async/`useEffect` async.

- [ ] **Step 8: Verificar tipos do projeto**

Run: `cd /c/Users/kauamiranda/Documents/controle-os-next && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 9: Commit**

```bash
git add src/lib/mobile/offline-db.ts src/lib/mobile/offline-queue.ts src/lib/mobile/__tests__ package.json package-lock.json src/hooks
git commit -m "feat(mobile): fila offline em IndexedDB com idempotência, backoff e conflito"
```

---

## Task 7: Smoke test ponta-a-ponta na VPS (staging)

**Files:** nenhum (validação operacional)

- [ ] **Step 1: Subir o backend com a migration**

Run (na VPS): `ssh -i ~/.ssh/id_vps root@2.25.194.47 "cd <path-do-projeto>/backend-senior && npx prisma migrate deploy && npm run build && pm2 restart <app> --update-env"`
Expected: migration aplicada, processo reiniciado sem erro nos logs.

- [ ] **Step 2: Validar idempotência via curl**

Run: enviar 2x o mesmo PATCH com o mesmo `Idempotency-Key` e token válido; confirmar que `version` não incrementa na 2ª e que vem header `idempotent-replayed: true`.
Expected: 2ª resposta idêntica, header presente.

- [ ] **Step 3: Validar conflito de versão**

Run: enviar PATCH com `expectedVersion` defasada.
Expected: HTTP 409 com `code: CONCURRENCY_CONFLICT`.

- [ ] **Step 4: Validar sync em lote**

Run: `POST /api/sync/batch` com 2 ações conflitantes.
Expected: 200, `results[0].status=ok`, `results[1].status=conflict`.

---

## Self-Review (cobertura do escopo)

- **Reenvio offline duplica dados** → Task 3 (idempotência) + Task 6 (header `Idempotency-Key`). ✔
- **Edição offline obsoleta sobrescreve** → Task 2 (`expectedVersion`) + Task 6 (envia versão) + tratamento 409 na fila. ✔
- **N round-trips em rede ruim** → Task 4 (batch) — disponível para a fila migrar a chamada agregada quando desejado. ✔
- **Fila perde dados / não guarda binário** → Task 6 (IndexedDB; base para anexos binários futuros). ✔
- **Sem backoff** → Task 6 (`backoff()` exponencial com jitter + `nextAttemptAt`). ✔
- **Proxy não repassa headers** → Task 5. ✔
- **`code` ausente nas respostas de erro** → Task 0. ✔

**Tipos consistentes:** `QueueAction.status` inclui `'conflict'` (offline-db.ts) e é usado em offline-queue.ts e nos testes; `SyncResult.status` usa `'ok'|'conflict'|'error'` em service, controller e teste; `expectedVersion: number` em schemas (Zod), service, sync e fila.

**Fora do escopo (mobile/offline) — registrar para plano futuro:** upload de fotos resiliente com fila binária em IndexedDB + hash de conteúdo; migração da fila para usar `/api/sync/batch` no lugar de N PATCHs; testes de carga/k6; graceful shutdown dos workers BullMQ.
