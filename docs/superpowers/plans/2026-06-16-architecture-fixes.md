# Architecture Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver 5 problemas arquiteturais identificados no architecture review — em ordem crescente de risco: offline queue sem userId (dado corrompido), backend services/ morto (dead code), HTTP client duplicado (bug duplicado), auth sem dono único (dessync), três tipos para Ordem de Serviço (cascade de mudanças).

**Architecture:** Cada task é independente e pode ser revertida sem afetar as outras. Fix 1 é cirúrgico em dois arquivos de mobile. Fix 2 é deleção pura no backend. Fix 3 cria uma fábrica e refatora dois clientes existentes. Fix 4 é additive-only: cria um hook wrapper sem remover os stores existentes. Fix 5 cria o tipo canônico e migra apenas os hooks (não o AppStore legado).

**Tech Stack:** Next.js 15, TypeScript 5, Fastify 5, Axios, TanStack Query v5, Zustand, Capacitor 8

**Verificação primária:** `node_modules/.bin/tsc --noEmit` (frontend) e `node_modules/.bin/tsc --noEmit` (backend-senior). Nenhum test runner configurado — Fix 3 inclui setup mínimo de Vitest.

---

## File Map

```
CRIAR
  src/lib/api/create-api-client.ts        ← Fix 3: fábrica compartilhada de Axios client
  src/hooks/useAuth.ts                    ← Fix 4: seam única de auth

MODIFICAR
  src/lib/mobile/offline-queue.ts         ← Fix 1: adicionar userId a QueueAction e syncQueue
  src/hooks/useServiceOrdersMobile.ts     ← Fix 1: passar userId nas chamadas a enqueue
  src/app/tecnico-mobile/page.tsx         ← Fix 1: passar userId em syncQueue
  src/lib/api/client.ts                   ← Fix 3: refatorar para usar createApiClient
  src/lib/api/mobile-client.ts            ← Fix 3: refatorar para usar createApiClient
  src/app/providers.tsx                   ← Fix 4: usar useAuth internamente

DELETAR
  backend-senior/src/services/attachmentService.ts   ← Fix 2
  backend-senior/src/services/authService.ts         ← Fix 2
  backend-senior/src/services/chipService.ts         ← Fix 2
  backend-senior/src/services/clientService.ts       ← Fix 2
  backend-senior/src/services/productService.ts      ← Fix 2
  backend-senior/src/services/serviceOrderService.ts ← Fix 2
  backend-senior/src/services/technicianService.ts   ← Fix 2

ATUALIZAR IMPORTS (Fix 2)
  backend-senior/src/controllers/authController.ts
  backend-senior/src/controllers/clientController.ts
  backend-senior/src/controllers/productController.ts
  backend-senior/src/controllers/serviceOrderController.ts
  backend-senior/src/controllers/technicianController.ts
  backend-senior/src/routes/uploadRoutes.ts
  backend-senior/src/routes/chipRoutes.ts (ou onde ChipService é importado)

NÃO TOCAR
  backend-senior/src/services/aiService.ts    ← código real, não é re-export
  backend-senior/src/services/userService.ts  ← código real, não é re-export
```

---

## Task 1: Offline Queue — Adicionar userId para Prevenir Replay Cross-User

**Contexto:** `QueueAction` não tem `userId`. Se dois técnicos usarem o mesmo dispositivo e um fizer logout antes da sync, as ações do primeiro são executadas com o token do segundo — corrompendo dados. Esta task adiciona `userId` à interface e protege `syncQueue` contra replay cross-user.

**Files:**
- Modify: `src/lib/mobile/offline-queue.ts`
- Modify: `src/hooks/useServiceOrdersMobile.ts`
- Modify: `src/app/tecnico-mobile/page.tsx`

---

- [ ] **Step 1.1: Adicionar `userId` a `QueueAction` e atualizar `enqueue`**

Substituir o conteúdo completo de `src/lib/mobile/offline-queue.ts`:

```typescript
export type QueueActionType =
  | "CHECKIN"
  | "UPDATE_EXECUTION"
  | "UPDATE_STATUS"
  | "COMPLETE_OS";

export interface QueueAction {
  id: string;
  userId: string;           // ← NOVO: quem enfileirou esta ação
  serviceOrderId: string;
  type: QueueActionType;
  payload: Record<string, unknown>;
  status: "pending" | "syncing" | "done" | "error";
  retryCount: number;
  createdAt: string;
  error?: string;
}

const QUEUE_KEY = "offline_queue_v2"; // ← versão bumped: limpa queue antiga sem userId
const MAX_RETRIES = 3;

function loadQueue(): QueueAction[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue: QueueAction[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }
}

export function enqueue(
  action: Omit<QueueAction, "id" | "status" | "retryCount" | "createdAt">
): void {
  const queue = loadQueue();
  queue.push({
    ...action,
    id: crypto.randomUUID(),
    status: "pending",
    retryCount: 0,
    createdAt: new Date().toISOString(),
  });
  saveQueue(queue);
}

export function getQueue(): QueueAction[] {
  return loadQueue();
}

export function getPendingCount(): number {
  return loadQueue().filter(
    (a) => a.status === "pending" || a.status === "syncing"
  ).length;
}

export function clearDoneItems(): void {
  saveQueue(loadQueue().filter((a) => a.status !== "done"));
}

async function executeAction(
  action: QueueAction,
  client: { patch: (url: string, data: unknown) => Promise<unknown> }
): Promise<void> {
  const { serviceOrderId, type, payload } = action;
  switch (type) {
    case "CHECKIN":
    case "UPDATE_EXECUTION":
      await client.patch(`/service-orders/${serviceOrderId}/execution`, payload);
      break;
    case "UPDATE_STATUS":
    case "COMPLETE_OS":
      await client.patch(`/service-orders/${serviceOrderId}/status`, payload);
      break;
  }
}

/**
 * Sincroniza a fila offline. Ações de outros usuários são puladas
 * para evitar replay com token errado em caso de troca de conta.
 */
export async function syncQueue(
  client: { patch: (url: string, data: unknown) => Promise<unknown> },
  currentUserId: string,
  onProgress?: (done: number, total: number) => void
): Promise<{ synced: number; failed: number; skipped: number }> {
  const queue = loadQueue();
  const pending = queue.filter(
    (a) =>
      (a.status === "pending" || (a.status === "error" && a.retryCount < MAX_RETRIES)) &&
      a.userId === currentUserId   // ← só executa ações do usuário atual
  );

  let synced = 0;
  let failed = 0;
  const skipped = queue.filter((a) => a.userId !== currentUserId && a.status === "pending").length;

  for (const action of pending) {
    const idx = queue.findIndex((a) => a.id === action.id);
    if (idx === -1) continue;
    queue[idx].status = "syncing";
    saveQueue(queue);

    try {
      await executeAction(action, client);
      queue[idx].status = "done";
      synced++;
    } catch (err) {
      queue[idx].retryCount++;
      queue[idx].status =
        queue[idx].retryCount >= MAX_RETRIES ? "error" : "pending";
      queue[idx].error =
        err instanceof Error ? err.message : "Erro desconhecido";
      failed++;
    }

    saveQueue(queue);
    onProgress?.(synced + failed, pending.length);
  }

  return { synced, failed, skipped };
}
```

- [ ] **Step 1.2: Verificar que TypeScript detecta erros nos callers**

```bash
cd C:\Users\kauamiranda\Desktop\controle-os-next
node_modules/.bin/tsc --noEmit 2>&1 | grep -E "offline-queue|ServiceOrdersMobile|tecnico-mobile"
```

Esperado: erros de tipo em `useServiceOrdersMobile.ts` (falta `userId` nos `enqueue`) e em `page.tsx` (`syncQueue` com 2 args).

- [ ] **Step 1.3: Atualizar `useServiceOrdersMobile.ts` — adicionar `userId` em todos os `enqueue`**

As três funções de mutation precisam chamar `useCurrentUserMobile()` para obter o userId e passá-lo ao `enqueue`. Aplicar cada bloco abaixo:

**`useCheckin`** — substituir a função inteira:
```typescript
export function useCheckin(serviceOrderId: string) {
  const qc = useQueryClient();
  const { data: me } = useCurrentUserMobile();
  return useMutation({
    mutationFn: async (payload: CheckinPayload) => {
      const online = await getNetworkStatus();
      if (online === "offline") {
        const userId = me?.id ?? "unknown";
        enqueue({ userId, serviceOrderId, type: "UPDATE_STATUS", payload: { status: "IN_PROGRESS" } });
        enqueue({ userId, serviceOrderId, type: "CHECKIN", payload: payload as unknown as Record<string, unknown> });
        return null;
      }
      await mobileApiClient.patch(`/service-orders/${serviceOrderId}/status`, {
        status: "IN_PROGRESS",
      });
      const { data } = await mobileApiClient.patch(
        `/service-orders/${serviceOrderId}/execution`,
        payload
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mobile", "orders"] }),
  });
}
```

**`useUpdateExecution`** — substituir a função inteira:
```typescript
export function useUpdateExecution(serviceOrderId: string) {
  const qc = useQueryClient();
  const { data: me } = useCurrentUserMobile();
  return useMutation({
    mutationFn: async (payload: UpdateExecutionPayload) => {
      const online = await getNetworkStatus();
      if (online === "offline") {
        enqueue({
          userId: me?.id ?? "unknown",
          serviceOrderId,
          type: "UPDATE_EXECUTION",
          payload: payload as Record<string, unknown>,
        });
        return null;
      }
      const { data } = await mobileApiClient.patch(
        `/service-orders/${serviceOrderId}/execution`,
        payload
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mobile", "orders"] }),
  });
}
```

**`useCompleteOS`** — substituir a função inteira:
```typescript
export function useCompleteOS(serviceOrderId: string) {
  const qc = useQueryClient();
  const { data: me } = useCurrentUserMobile();
  return useMutation({
    mutationFn: async (payload: {
      checkoutAt: string;
      checkoutLat?: number;
      checkoutLng?: number;
    }) => {
      const online = await getNetworkStatus();
      if (online === "offline") {
        const userId = me?.id ?? "unknown";
        enqueue({
          userId,
          serviceOrderId,
          type: "UPDATE_EXECUTION",
          payload: payload as Record<string, unknown>,
        });
        enqueue({
          userId,
          serviceOrderId,
          type: "COMPLETE_OS",
          payload: { status: "COMPLETED" },
        });
        return null;
      }
      await mobileApiClient.patch(`/service-orders/${serviceOrderId}/execution`, payload);
      const { data } = await mobileApiClient.patch(
        `/service-orders/${serviceOrderId}/status`,
        { status: "COMPLETED" }
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mobile", "orders"] }),
  });
}
```

- [ ] **Step 1.4: Atualizar `page.tsx` — passar `me?.id` em `syncQueue`**

Localizar as duas chamadas a `syncQueue(mobileApiClient)` em `src/app/tecnico-mobile/page.tsx` (linhas ~153 e ~455) e substituir por:

```typescript
syncQueue(mobileApiClient, me?.id ?? "unknown")
```

> `me` já está disponível no componente via `const { data: me, isLoading: meLoading } = useCurrentUserMobile();` (linha ~163).
> Verificar que ambas as ocorrências são atualizadas — uma está em `handleSync` e outra em um `useEffect`.

- [ ] **Step 1.5: Type check completo**

```bash
cd C:\Users\kauamiranda\Desktop\controle-os-next
node_modules/.bin/tsc --noEmit
```

Esperado: zero erros de TypeScript.

- [ ] **Step 1.6: Commit**

```bash
cd C:\Users\kauamiranda\Desktop\controle-os-next
git add src/lib/mobile/offline-queue.ts src/hooks/useServiceOrdersMobile.ts src/app/tecnico-mobile/page.tsx
git commit -m "fix(mobile): add userId to QueueAction to prevent cross-user offline replay"
```

---

## Task 2: Backend — Deletar Camada de Re-export Morta em services/

**Contexto:** Sete arquivos em `backend-senior/src/services/` são re-exports de uma linha de `modules/`. Os controllers importam de `services/`, que re-exportam de `modules/`. É um hop inútil. Esta task deleta esses arquivos e atualiza os imports dos controllers diretamente para os módulos. Os arquivos `aiService.ts` e `userService.ts` têm lógica real e **não são deletados**.

**Files:**
- Delete: 7 arquivos em `backend-senior/src/services/`
- Modify: `backend-senior/src/controllers/authController.ts`
- Modify: `backend-senior/src/controllers/clientController.ts`
- Modify: `backend-senior/src/controllers/productController.ts`
- Modify: `backend-senior/src/controllers/serviceOrderController.ts`
- Modify: `backend-senior/src/controllers/technicianController.ts`
- Modify: `backend-senior/src/routes/uploadRoutes.ts`
- Modify: qualquer arquivo que importe de `services/chipService` ou `services/attachmentService`

---

- [ ] **Step 2.1: Identificar todos os imports para atualizar**

```bash
cd C:\Users\kauamiranda\Desktop\controle-os-next\backend-senior
grep -rn "from.*services/" src/ --include="*.ts" | grep -v "aiService\|userService"
```

Esperado: 8 linhas listando os imports a substituir.

- [ ] **Step 2.2: Atualizar import em `authController.ts`**

Substituir:
```typescript
import { AuthService, loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from '../services/authService';
```
Por:
```typescript
import { AuthService, loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from '../modules/auth/auth.service';
```

- [ ] **Step 2.3: Atualizar import em `clientController.ts`**

Substituir:
```typescript
import { ClientService, createClientSchema, updateClientSchema } from '../services/clientService';
```
Por:
```typescript
import { ClientService, createClientSchema, updateClientSchema } from '../modules/client/client.service';
```

- [ ] **Step 2.4: Atualizar import em `productController.ts`**

Substituir:
```typescript
import { ProductService, createProductSchema } from '../services/productService';
```
Por:
```typescript
import { ProductService, createProductSchema } from '../modules/product/product.service';
```

- [ ] **Step 2.5: Atualizar imports em `serviceOrderController.ts`**

Substituir o import de `services/serviceOrderService` por dois imports diretos dos módulos:
```typescript
import { ServiceOrderService } from '../modules/service-order/service-order.service';
import {
  createOSSchema,
  updateExecutionSchema,
  updateStatusSchema,
  assignSchema,
  canTransition,
  type CreateOSInput,
  type UpdateExecutionInput,
  type UpdateStatusInput,
  type AssignInput,
} from '../modules/service-order/service-order.rules';
```

> Nota: os nomes `createOSSchema` e `CreateOSInput` são os aliases do re-export (`createServiceOrderSchema as createOSSchema`). Verificar se o controller usa esses aliases ou os nomes originais antes de editar.

Verificar o import atual:
```bash
head -15 C:\Users\kauamiranda\Desktop\controle-os-next\backend-senior\src\controllers\serviceOrderController.ts
```

Se o controller importa `createOSSchema`, use o alias. Se importa `createServiceOrderSchema`, use o nome original de `service-order.rules`.

- [ ] **Step 2.6: Atualizar import em `technicianController.ts`**

Substituir:
```typescript
import { TechnicianService, createTechnicianSchema, updateTechnicianSchema } from '../services/technicianService';
```
Por:
```typescript
import { TechnicianService, createTechnicianSchema, updateTechnicianSchema } from '../modules/technician/technician.service';
```

- [ ] **Step 2.7: Atualizar import em `uploadRoutes.ts`**

Substituir:
```typescript
import { AttachmentService } from '../services/attachmentService';
```
Por:
```typescript
import { AttachmentService } from '../modules/attachment/attachment.service';
```

- [ ] **Step 2.8: Atualizar qualquer import de chipService**

```bash
grep -rn "from.*services/chipService" C:\Users\kauamiranda\Desktop\controle-os-next\backend-senior\src --include="*.ts"
```

Para cada arquivo encontrado, substituir `'../services/chipService'` por `'../modules/chip/chip.service'`.

- [ ] **Step 2.9: Type check do backend**

```bash
cd C:\Users\kauamiranda\Desktop\controle-os-next\backend-senior
node_modules/.bin/tsc --noEmit
```

Esperado: zero erros. Se houver erros de "Module not found", algum import ainda aponta para services/.

- [ ] **Step 2.10: Deletar os 7 arquivos de re-export**

```bash
cd C:\Users\kauamiranda\Desktop\controle-os-next\backend-senior\src\services
rm attachmentService.ts authService.ts chipService.ts clientService.ts productService.ts serviceOrderService.ts technicianService.ts
```

- [ ] **Step 2.11: Type check novamente (confirmar que nenhum import ainda usa os arquivos deletados)**

```bash
cd C:\Users\kauamiranda\Desktop\controle-os-next\backend-senior
node_modules/.bin/tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 2.12: Commit**

```bash
cd C:\Users\kauamiranda\Desktop\controle-os-next
git add backend-senior/src/
git commit -m "refactor(backend): remove services/ re-export layer, import modules directly"
```

---

## Task 3: Criar `createApiClient` — Fábrica Compartilhada para Web e Mobile

**Contexto:** A lógica de refresh com coalescing existe em duas cópias quase idênticas (`client.ts` e `mobile-client.ts`). Esta task extrai uma fábrica tipada `createApiClient(config)` e refatora os dois clientes para usá-la. Como bônus, corrige o bug de loop infinito no mobile client atual (falta de `_retry` guard).

**Files:**
- Create: `src/lib/api/create-api-client.ts`
- Modify: `src/lib/api/client.ts`
- Modify: `src/lib/api/mobile-client.ts`

---

- [ ] **Step 3.1: Criar `src/lib/api/create-api-client.ts`**

```typescript
import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";

export type RefreshResult = "ok" | "auth_failed" | "transient";

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  /** Chamado em cada request — pode injetar headers (CSRF, Authorization). */
  beforeRequest?: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig;
  /**
   * Executa o refresh de token.
   * - 'ok'          → sucesso, retry a request original
   * - 'auth_failed' → token inválido/expirado → chamar onAuthFailed
   * - 'transient'   → falha temporária (5xx, rede) → propagar erro sem logout
   */
  doRefresh: () => Promise<RefreshResult>;
  /**
   * Chamado depois de um refresh bem-sucedido para injetar o novo header
   * de Authorization na request retentada. Não necessário para web (cookies).
   */
  getAuthHeader?: () => string | null;
  /** Chamado quando auth_failed — deve redirecionar para login e limpar tokens. */
  onAuthFailed: () => Promise<void>;
}

type RetryableConfig = AxiosRequestConfig & { _retry?: boolean };

/**
 * Cria um Axios instance com refresh automático e coalescing de 401s.
 * Múltiplos 401 concorrentes disparam uma única chamada de refresh.
 */
export function createApiClient(config: ApiClientConfig): AxiosInstance {
  const instance = axios.create({
    baseURL: config.baseURL,
    headers: { "Content-Type": "application/json" },
    timeout: config.timeout ?? 15000,
  });

  if (config.beforeRequest) {
    instance.interceptors.request.use(config.beforeRequest);
  }

  let _refreshPromise: Promise<RefreshResult> | null = null;

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const cfg = error.config as RetryableConfig | undefined;

      if (error.response?.status !== 401 || !cfg || cfg._retry) {
        if (error.response?.status === 401) {
          await config.onAuthFailed();
        }
        return Promise.reject(error);
      }

      cfg._retry = true;

      if (!_refreshPromise) {
        _refreshPromise = config.doRefresh().finally(() => {
          _refreshPromise = null;
        });
      }

      const result = await _refreshPromise;

      if (result === "auth_failed") {
        await config.onAuthFailed();
        return Promise.reject(error);
      }

      if (result === "transient") {
        return Promise.reject(error);
      }

      if (config.getAuthHeader) {
        const header = config.getAuthHeader();
        if (header) cfg.headers = { ...cfg.headers, Authorization: header };
      }

      return instance(cfg);
    }
  );

  return instance;
}
```

- [ ] **Step 3.2: Refatorar `src/lib/api/client.ts` para usar a fábrica**

Substituir o conteúdo completo de `src/lib/api/client.ts`:

```typescript
import { createApiClient } from "./create-api-client";

const MUTABLE_METHODS = new Set(["post", "put", "patch", "delete"]);

function getCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith("csrf_token="));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

async function doWebRefresh() {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) return "ok" as const;
    if (res.status === 401 || res.status === 403) return "auth_failed" as const;
    return "transient" as const;
  } catch {
    return "transient" as const;
  }
}

export const apiClient = createApiClient({
  baseURL: "/api/backend",
  beforeRequest: (config) => {
    const method = (config.method ?? "").toLowerCase();
    if (MUTABLE_METHODS.has(method)) {
      const csrf = getCsrfCookie();
      if (csrf) config.headers["x-csrf-token"] = csrf;
    }
    return config;
  },
  doRefresh: doWebRefresh,
  onAuthFailed: async () => {
    if (typeof window !== "undefined") window.location.href = "/login";
  },
});
```

- [ ] **Step 3.3: Refatorar `src/lib/api/mobile-client.ts` para usar a fábrica**

Substituir o conteúdo completo de `src/lib/api/mobile-client.ts`:

```typescript
import { createApiClient } from "./create-api-client";
import {
  getToken,
  setToken,
  clearToken,
  getRefreshToken,
  setRefreshToken,
  clearRefreshToken,
} from "@/lib/mobile/storage";

const FASTIFY_URL = process.env.NEXT_PUBLIC_FASTIFY_URL ?? "http://localhost:3333";

let _token: string | null = null;
let _refreshToken: string | null = null;

async function doMobileRefresh() {
  const storedRefresh = _refreshToken ?? (await getRefreshToken());
  if (!storedRefresh) return "auth_failed" as const;

  try {
    const res = await fetch("/api/auth/mobile-refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: storedRefresh }),
    });

    if (!res.ok) return "auth_failed" as const;

    const data = (await res.json()) as { accessToken?: string; refreshToken?: string };
    if (!data.accessToken) return "auth_failed" as const;

    _token = data.accessToken;
    await setToken(data.accessToken);

    if (data.refreshToken) {
      _refreshToken = data.refreshToken;
      await setRefreshToken(data.refreshToken);
    }

    return "ok" as const;
  } catch {
    return "transient" as const;
  }
}

async function onMobileAuthFailed() {
  await clearToken();
  await clearRefreshToken();
  _token = null;
  _refreshToken = null;
  if (typeof window !== "undefined") {
    window.location.href = "/tecnico-mobile/login/";
  }
}

export const mobileApiClient = createApiClient({
  baseURL: `${FASTIFY_URL}/api`,
  beforeRequest: (config) => {
    if (_token) config.headers.Authorization = `Bearer ${_token}`;
    return config;
  },
  doRefresh: doMobileRefresh,
  getAuthHeader: () => (_token ? `Bearer ${_token}` : null),
  onAuthFailed: onMobileAuthFailed,
});

export async function initMobileAuth(): Promise<string | null> {
  _token = await getToken();
  _refreshToken = await getRefreshToken();
  return _token;
}

export async function storeMobileTokens(accessToken: string, refreshToken?: string): Promise<void> {
  _token = accessToken;
  await setToken(accessToken);
  if (refreshToken) {
    _refreshToken = refreshToken;
    await setRefreshToken(refreshToken);
  }
}

export async function removeMobileTokens(): Promise<void> {
  await clearToken();
  await clearRefreshToken();
  _token = null;
  _refreshToken = null;
}

export function getMobileToken(): string | null {
  return _token;
}

/** @deprecated Use storeMobileTokens */
export async function storeMobileToken(token: string): Promise<void> {
  return storeMobileTokens(token);
}

/** @deprecated Use removeMobileTokens */
export async function removeMobileToken(): Promise<void> {
  return removeMobileTokens();
}

/** @deprecated Use storeMobileTokens (async) */
export function setMobileToken(token: string): void {
  _token = token;
  void setToken(token);
}

/** @deprecated Use removeMobileTokens (async) */
export function clearMobileToken(): void {
  _token = null;
  void clearToken();
}
```

- [ ] **Step 3.4: Type check completo do frontend**

```bash
cd C:\Users\kauamiranda\Desktop\controle-os-next
node_modules/.bin/tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3.5: Commit**

```bash
cd C:\Users\kauamiranda\Desktop\controle-os-next
git add src/lib/api/create-api-client.ts src/lib/api/client.ts src/lib/api/mobile-client.ts
git commit -m "refactor(api): extract createApiClient factory, eliminate duplicated refresh logic"
```

---

## Task 4: Criar `useAuth()` — Seam Única de Autenticação

**Contexto:** Auth está espalhada por 5 arquivos sem dono único. `useAuthStore` guarda `user`, `useAppStore` guarda `role`, `providers.tsx` inicializa via fetch direto, `login/page.tsx` faz fetch manual. Esta task cria um `useAuth()` hook como seam única — additive-only, sem remover os stores existentes. Componentes podem migrar gradualmente.

**Files:**
- Create: `src/hooks/useAuth.ts`
- Modify: `src/app/providers.tsx`
- Modify: `src/app/login/page.tsx`

---

- [ ] **Step 4.1: Criar `src/hooks/useAuth.ts`**

```typescript
"use client";

import { useAuthStore } from "@/store/use-auth-store";
import { useAppStore } from "@/store/use-app-store";
import { backendRoleToFrontend } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";
import type { Role } from "@/lib/types";

interface UseAuthReturn {
  user: AuthUser | null;
  role: Role;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: AuthUser };
    return data.user ?? null;
  } catch {
    return null;
  }
}

/**
 * Seam única de autenticação. Source of truth para user, role e loading.
 * Encapsula os stores useAuthStore e useAppStore (role).
 *
 * Uso:
 *   const { user, role, loading, login, logout } = useAuth();
 */
export function useAuth(): UseAuthReturn {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const role = useAppStore((s) => s.role);
  const setUser = useAuthStore((s) => s.setUser);
  const clear = useAuthStore((s) => s.clear);
  const setRole = useAppStore((s) => s.setRole);

  async function login(email: string, password: string): Promise<AuthUser> {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json()) as { user?: AuthUser; message?: string };
    if (!res.ok) throw new Error(data.message ?? "Credenciais inválidas.");
    if (!data.user) throw new Error("Resposta inesperada do servidor.");
    setUser(data.user);
    setRole(backendRoleToFrontend(data.user.role));
    return data.user;
  }

  async function logout(): Promise<void> {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignora falha de rede — logout local é obrigatório
    }
    clear();
    setRole("admin");
    if (typeof window !== "undefined") window.location.href = "/login";
  }

  return { user, role, loading, login, logout };
}

/**
 * Inicializa o estado de auth buscando /api/auth/me.
 * Deve ser chamado uma vez em AuthInitializer (providers.tsx).
 */
export async function initAuth(
  setUser: (user: AuthUser | null) => void,
  setRole: (role: Role) => void
): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch("/api/auth/me", { signal: controller.signal });
    clearTimeout(timeout);

    const data = res.ok
      ? ((await res.json()) as { user?: AuthUser })
      : null;

    if (data?.user) {
      setUser(data.user);
      setRole(backendRoleToFrontend(data.user.role));
    } else {
      setUser(null);
    }
  } catch {
    setUser(null);
  }
}
```

- [ ] **Step 4.2: Atualizar `src/app/providers.tsx` para usar `initAuth`**

Substituir o conteúdo completo de `src/app/providers.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/react-query/queryClient";
import { useAuthStore } from "@/store/use-auth-store";
import { useAppStore } from "@/store/use-app-store";
import { initAuth } from "@/hooks/useAuth";

function AuthInitializer() {
  const setUser = useAuthStore((s) => s.setUser);
  const setRole = useAppStore((s) => s.setRole);

  useEffect(() => {
    const hasCsrf = document.cookie.includes("csrf_token=");
    if (!hasCsrf) fetch("/api/auth/csrf").catch(() => undefined);

    void initAuth(setUser, setRole);
  }, [setUser, setRole]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer />
      {children}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4.3: Atualizar `src/app/login/page.tsx` para usar `useAuth().login`**

Localizar o arquivo `src/app/login/page.tsx`. Identificar onde faz fetch manual a `/api/auth/login` e substituir por `useAuth().login`.

A função `handleSubmit` deve ficar assim (adaptar ao código existente):

```typescript
import { useAuth } from "@/hooks/useAuth";

// Dentro do componente:
const { login } = useAuth();

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setError(null);
  setLoading(true);
  try {
    await login(email, password);
    router.replace("/");
  } catch (err) {
    setError(err instanceof Error ? err.message : "Erro ao entrar.");
  } finally {
    setLoading(false);
  }
}
```

> Remover o import de `useAuthStore` e `useAppStore` do `login/page.tsx` se não forem mais usados após a migração.

- [ ] **Step 4.4: Type check completo**

```bash
cd C:\Users\kauamiranda\Desktop\controle-os-next
node_modules/.bin/tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4.5: Commit**

```bash
cd C:\Users\kauamiranda\Desktop\controle-os-next
git add src/hooks/useAuth.ts src/app/providers.tsx src/app/login/page.tsx
git commit -m "refactor(auth): create useAuth() seam, centralize login/logout/init logic"
```

---

## Task 5: Tipo Canônico de Ordem de Serviço

**Contexto:** Existem três shapes incompatíveis para a mesma entidade: tipo legado em `types.ts` (mock/demo), tipo do hook web, tipo do hook mobile. Esta task cria `src/lib/domain/service-order.ts` com o tipo canônico que espelha o backend, e migra os dois hooks de produção (`useServiceOrders.ts`, `useServiceOrdersMobile.ts`) para usá-lo. O tipo legado em `types.ts` (usado pelo `useAppStore` de demo) é preservado sem alteração — ele pertence ao estado de mock, não ao backend.

**Files:**
- Create: `src/lib/domain/service-order.ts`
- Modify: `src/hooks/useServiceOrders.ts` (substituir tipos inline)
- Modify: `src/hooks/useServiceOrdersMobile.ts` (substituir `MobileServiceOrder`)

---

- [ ] **Step 5.1: Criar `src/lib/domain/service-order.ts`**

```typescript
/**
 * Tipos canônicos de Ordem de Serviço — espelham o schema do backend (Prisma).
 * Use estes tipos em hooks e componentes que consomem dados reais da API.
 *
 * O tipo `ServiceOrder` em src/lib/types.ts é o shape legado do AppStore de demo
 * e não deve ser usado para dados do backend.
 */

export type OsStatus =
  | "ABERTA"
  | "EM_ANDAMENTO"
  | "AGUARDANDO_PECAS"
  | "CONCLUIDA"
  | "CANCELADA";

export type OsPriority = "NORMAL" | "WARNING" | "HIGH";

export interface OsClient {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface OsTechnician {
  id: string;
  name: string;
  phone?: string | null;
}

export interface OsExecution {
  checkinAt?: string | null;
  checkoutAt?: string | null;
  checkinLat?: number | null;
  checkinLng?: number | null;
  checkoutLat?: number | null;
  checkoutLng?: number | null;
  /** @deprecated Use photoAttachmentIds */
  photoUrls?: string[];
  photoAttachmentIds?: string[];
  /** @deprecated Use signatureAttachmentId */
  clientSignature?: string;
  signatureAttachmentId?: string;
  chipIccid?: string;
  workDoneNotes?: string;
}

export interface ServiceOrderCanonical {
  id: string;
  number: string;
  status: OsStatus;
  priority: OsPriority;
  description?: string | null;
  scheduledAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  client?: OsClient | null;
  technician?: OsTechnician | null;
  execution?: OsExecution | null;
  /** @deprecated Use photoAttachmentIds dentro de execution */
  photoUrls?: string[];
  /** @deprecated Use signatureAttachmentId dentro de execution */
  clientSignature?: string;
}
```

- [ ] **Step 5.2: Atualizar `useServiceOrders.ts` para importar de domain**

Localizar as declarações de tipo inline no arquivo (interfaces como `ServiceOrderWeb`, ou o tipo de retorno da queryFn) e substituir os campos de execution pelos tipos de `OsExecution`. Adicionar o import:

```typescript
import type { ServiceOrderCanonical, OsStatus, OsPriority } from "@/lib/domain/service-order";
```

Substituir qualquer tipo local de OS que espelhe o backend por `ServiceOrderCanonical`. Preservar qualquer tipo que seja específico da camada de apresentação (ex: campos calculados).

- [ ] **Step 5.3: Atualizar `useServiceOrdersMobile.ts` — substituir `MobileServiceOrder`**

Adicionar import:
```typescript
import type { ServiceOrderCanonical } from "@/lib/domain/service-order";
```

Substituir a interface `MobileServiceOrder` pela re-export do tipo canônico:
```typescript
// MobileServiceOrder é agora um alias do tipo canônico
export type MobileServiceOrder = ServiceOrderCanonical;
```

> Se `MobileServiceOrder` tiver campos extras não presentes em `ServiceOrderCanonical`, adicionar esses campos ao tipo canônico (Task 5.1) antes de fazer o alias. Não remover campos — apenas consolidar.

- [ ] **Step 5.4: Type check completo**

```bash
cd C:\Users\kauamiranda\Desktop\controle-os-next
node_modules/.bin/tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 5.5: Commit**

```bash
cd C:\Users\kauamiranda\Desktop\controle-os-next
git add src/lib/domain/service-order.ts src/hooks/useServiceOrders.ts src/hooks/useServiceOrdersMobile.ts
git commit -m "refactor(types): create canonical ServiceOrderCanonical type in lib/domain"
```

---

## Self-Review

### Spec Coverage

| Candidato | Task | Coberto? |
|---|---|---|
| 03 — Offline Queue sem userId | Task 1 | ✓ |
| 05 — Backend services/ morto | Task 2 | ✓ |
| 01 — Dual HTTP clients | Task 3 | ✓ |
| 02 — Auth sem seam | Task 4 | ✓ |
| 06 — Três tipos de OS | Task 5 | ✓ |
| 04 — Hooks mecânicos | — | Fora do escopo (Worth exploring, não Strong) |

### Dependências entre tasks

- Tasks 1, 2 e 3 são **completamente independentes** → podem ser executadas em paralelo
- Task 4 não toca arquivos das tasks 1–3 → independente
- Task 5 não toca arquivos das tasks 1–4 → independente
- Recomendação de execução: Task 2 (mais simples), Task 1, Task 3, Task 4, Task 5

### Riscos anotados

- **Task 2 Step 2.5:** `serviceOrderController.ts` usa aliases (`createOSSchema`). Verificar o import atual antes de editar (Step diz para fazer isso).
- **Task 3:** O `mobile-client.ts` atual (versão que escrevemos ontem) tem lógica de refresh mais rica que a versão anterior. A task 3 vai substituir esse arquivo — verificar se toda a lógica foi preservada na nova versão antes de commitar.
- **Task 4:** `login/page.tsx` tem UI complexa (framer-motion, error state). Step 4.3 muda apenas a chamada de auth — não tocar o resto do componente.
- **Task 5 Step 5.3:** `MobileServiceOrder` pode ter campos que `ServiceOrderCanonical` não tem. Verificar antes de fazer o alias — adicionar campos faltantes ao tipo canônico se necessário.
