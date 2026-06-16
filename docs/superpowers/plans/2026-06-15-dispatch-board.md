# Dispatch Board — Melhorias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar 3 melhorias ao `DispatchBoard` existente sem reescrever o componente: (1) navegação de data, (2) modal de horário ao despachar, (3) equipes reais da API.

**Architecture:** Todas as mudanças são cirúrgicas — o componente `src/components/dashboard/dispatch-board.tsx` recebe estado de data e um novo `AssignModal`; o backend ganha uma rota `GET /api/teams`; o hook `useAssignServiceOrder` passa a enviar `scheduledStart`. Nenhum arquivo existente é deletado ou reescrito por completo.

**Tech Stack:** Next.js 15, React Query, Fastify, Prisma (Team já existe no schema), Tailwind CSS v4, Radix UI Dialog (já instalado)

---

## Mapa de arquivos

| Arquivo | O que muda |
|---|---|
| `src/components/dashboard/dispatch-board.tsx` | +date state, +filtro por data, +AssignModal ao drop |
| `src/components/dashboard/assign-modal.tsx` | **Novo** — modal com seletor de horário |
| `src/hooks/useTeams.ts` | **Novo** — React Query para `GET /api/teams` |
| `src/hooks/useServiceOrders.ts` | `useAssignServiceOrder` passa a aceitar `scheduledStart` |
| `src/lib/adapters.ts` | `adaptBackendOrder` mapeia `scheduledStart` do backend |
| `backend-senior/src/routes/teamRoutes.ts` | **Novo** — `GET /api/teams` lista equipes com membros |
| `backend-senior/src/app.ts` | Registra `teamRoutes` em `/api/teams` |

---

## Task 1: Rota GET /api/teams no backend

**Files:**
- Create: `backend-senior/src/routes/teamRoutes.ts`
- Modify: `backend-senior/src/app.ts`

- [ ] **Step 1: Escrever o teste**

```typescript
// backend-senior/tests/teamRoutes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    team: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '../src/lib/prisma';

const mockTeams = [
  {
    id: 'team-1',
    name: 'Equipe Alpha',
    active: true,
    members: [
      { technician: { id: 'tech-1', name: 'João Silva', status: 'AVAILABLE' } },
      { technician: { id: 'tech-2', name: 'Pedro Costa', status: 'BUSY' } },
    ],
  },
];

describe('GET /api/teams', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna equipes com membros formatados', async () => {
    vi.mocked(prisma.team.findMany).mockResolvedValue(mockTeams as any);

    // Importa a função de query diretamente para testar sem Fastify
    const { listTeams } = await import('../src/routes/teamRoutes');
    const result = await listTeams('company-1');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Equipe Alpha');
    expect(result[0].members).toHaveLength(2);
    expect(result[0].members[0].name).toBe('João Silva');
    expect(result[0].online).toBe(true); // João está AVAILABLE
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

```bash
cd backend-senior
npx vitest run tests/teamRoutes.test.ts
```

Esperado: `FAIL` — `Cannot find module` ou `listTeams is not exported`.

- [ ] **Step 3: Criar teamRoutes.ts**

```typescript
// backend-senior/src/routes/teamRoutes.ts
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/auth';

interface RequestUser { companyId: string; }

export async function listTeams(companyId: string) {
  const teams = await prisma.team.findMany({
    where: { companyId, active: true, deletedAt: null },
    include: {
      members: {
        include: {
          technician: { select: { id: true, name: true, status: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    members: t.members.map((m) => ({
      id: m.technician.id,
      name: m.technician.name,
    })),
    online: t.members.some((m) => m.technician.status === 'AVAILABLE'),
  }));
}

export default async function teamRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.get('/', async (req, reply) => {
    const user = req.user as RequestUser;
    const teams = await listTeams(user.companyId);
    return reply.send(teams);
  });
}
```

- [ ] **Step 4: Rodar teste e confirmar que passa**

```bash
npx vitest run tests/teamRoutes.test.ts
```

Esperado: `PASS` — 1 test passed.

- [ ] **Step 5: Registrar rota em app.ts**

Abra `backend-senior/src/app.ts`. Adicione o import após os imports existentes de rotas:

```typescript
import teamRoutes from './routes/teamRoutes';
```

Adicione o registro após o último `await app.register(auditRoutes, ...)`:

```typescript
await app.register(teamRoutes, { prefix: '/api/teams' });
```

- [ ] **Step 6: Verificar build**

```bash
npm run build
```

Esperado: zero erros TypeScript.

- [ ] **Step 7: Commit**

```bash
git add backend-senior/src/routes/teamRoutes.ts backend-senior/src/app.ts backend-senior/tests/teamRoutes.test.ts
git commit -m "feat(dispatch): add GET /api/teams with members and online status"
```

---

## Task 2: Hook useTeams no frontend

**Files:**
- Create: `src/hooks/useTeams.ts`

- [ ] **Step 1: Criar hook**

```typescript
// src/hooks/useTeams.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface Team {
  id: string;
  name: string;
  members: { id: string; name: string }[];
  online: boolean;
}

async function fetchTeams(): Promise<Team[]> {
  const { data } = await apiClient.get('/teams');
  return data;
}

export function useTeams() {
  return useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: fetchTeams,
    staleTime: 60_000,
  });
}
```

- [ ] **Step 2: Verificar tipos**

```bash
cd /caminho/para/controle-os-next
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTeams.ts
git commit -m "feat(dispatch): add useTeams hook"
```

---

## Task 3: Mapear scheduledStart no adapter e na mutation

**Files:**
- Modify: `src/lib/adapters.ts`
- Modify: `src/hooks/useServiceOrders.ts`

- [ ] **Step 1: Adicionar scheduledStart ao adapter**

Abra `src/lib/adapters.ts`. Localize a função `adaptBackendOrder` e adicione o campo `scheduledStart` no objeto retornado, logo após a linha `time`:

```typescript
// Linha atual:
time: os.scheduledTime ?? "00:00",
team: os.team ?? "Sem equipe",

// Substituir por:
time: os.scheduledTime ?? os.scheduledStart?.slice(11, 16) ?? "00:00",
scheduledStart: os.scheduledStart ?? null,
team: os.team ?? "Sem equipe",
```

- [ ] **Step 2: Adicionar scheduledStart ao tipo ServiceOrder**

Abra `src/lib/types.ts`. Localize a interface `ServiceOrder` e adicione o campo:

```typescript
export interface ServiceOrder {
  _backendId?: string;
  code: string;
  client: string;
  description: string;
  tech: string;
  time: string;
  scheduledStart?: string | null;   // ← adicionar esta linha
  team: string;
  priority: "high" | "warning" | "normal";
  status: "pending" | "scheduled" | "completed" | "cancelled";
  scheduledDate?: string;
}
```

- [ ] **Step 3: Adicionar scheduledStart à mutation de assign**

Abra `src/hooks/useServiceOrders.ts`. Localize a função `assignServiceOrder` e o hook `useAssignServiceOrder`:

```typescript
// Função (antes):
async function assignServiceOrder(id: string, team: string, technicianId?: string | null): Promise<ServiceOrder> {
  const { data } = await apiClient.patch(`/service-orders/${id}/assign`, { team, technicianId });
  return data;
}

// Função (depois):
async function assignServiceOrder(
  id: string,
  team: string,
  technicianId?: string | null,
  scheduledStart?: string | null,
): Promise<ServiceOrder> {
  const { data } = await apiClient.patch(`/service-orders/${id}/assign`, {
    team,
    technicianId,
    ...(scheduledStart ? { scheduledStart } : {}),
  });
  return data;
}
```

```typescript
// Hook (antes):
export function useAssignServiceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, team, technicianId }: { id: string; team: string; technicianId?: string | null }) =>
      assignServiceOrder(id, team, technicianId),

// Hook (depois):
export function useAssignServiceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, team, technicianId, scheduledStart }: {
      id: string;
      team: string;
      technicianId?: string | null;
      scheduledStart?: string | null;
    }) => assignServiceOrder(id, team, technicianId, scheduledStart),
```

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 5: Commit**

```bash
git add src/lib/adapters.ts src/lib/types.ts src/hooks/useServiceOrders.ts
git commit -m "feat(dispatch): add scheduledStart to adapter, ServiceOrder type and assign mutation"
```

---

## Task 4: AssignModal — modal de horário ao despachar

**Files:**
- Create: `src/components/dashboard/assign-modal.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/dashboard/assign-modal.tsx
"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 07..19

interface AssignModalProps {
  osCode: string;
  osDescription: string;
  teamName: string;
  onConfirm: (scheduledStart: string) => void;
  onCancel: () => void;
  isPending: boolean;
}

function todayAt(hour: number): string {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export function AssignModal({
  osCode,
  osDescription,
  teamName,
  onConfirm,
  onCancel,
  isPending,
}: AssignModalProps) {
  const [hour, setHour] = useState(() => {
    const h = new Date().getHours();
    return Math.min(Math.max(h, 7), 19);
  });

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-72 bg-panel border border-line rounded-md shadow-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-[13px] font-semibold text-ink">
              Confirmar despacho
            </Dialog.Title>
            <button onClick={onCancel} className="text-muted hover:text-ink transition-colors">
              <X className="size-3.5" />
            </button>
          </div>

          <div className="space-y-2 text-[12px] mb-4">
            <Row label="OS" value={`${osCode} — ${osDescription}`} />
            <Row label="Equipe" value={teamName} />
          </div>

          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">
              Horário agendado
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {HOURS.map((h) => (
                <button
                  key={h}
                  onClick={() => setHour(h)}
                  className={cn(
                    "py-1.5 rounded-sm text-[11px] font-mono border transition-colors",
                    hour === h
                      ? "bg-accent text-white border-accent"
                      : "border-line text-muted hover:border-foreground/20 hover:text-ink",
                  )}
                >
                  {String(h).padStart(2, "0")}h
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 py-1.5 rounded border border-line text-[12px] text-muted hover:bg-surface transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => onConfirm(todayAt(hour))}
              disabled={isPending}
              className="flex-1 py-1.5 rounded bg-accent text-white text-[12px] font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {isPending ? "Despachando..." : "Despachar"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 items-start">
      <span className="text-muted shrink-0 w-12">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/assign-modal.tsx
git commit -m "feat(dispatch): add AssignModal with hour picker"
```

---

## Task 5: Melhorias no DispatchBoard existente

**Files:**
- Modify: `src/components/dashboard/dispatch-board.tsx`

Esta task modifica o componente existente em 4 pontos cirúrgicos. Faça as alterações na ordem abaixo.

- [ ] **Step 1: Adicionar imports novos no topo do arquivo**

Após os imports existentes, adicione:

```typescript
import { useTeams } from "@/hooks/useTeams";
import { AssignModal } from "@/components/dashboard/assign-modal";
```

- [ ] **Step 2: Adicionar estado de data e pending no DispatchBoard**

Dentro da função `DispatchBoard`, logo após as linhas de `useState` existentes:

```typescript
// Adicionar após: const [overTeam, setOverTeam] = useState<string | null>(null);
const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
const [pending, setPending] = useState<{ backendId: string; code: string; description: string; teamName: string } | null>(null);
```

- [ ] **Step 3: Substituir TEAMS hardcoded por dados da API**

Substitua a linha:

```typescript
// Antes:
const visibleTeams = technicianView ? TEAMS.filter((t) => t === activeTeam) : TEAMS;

const teamMembers = (team: string) =>
  technicians.filter((t) => t.team === team).map((t) => t.name).join(", ") || "Sem tecnico";
```

Por:

```typescript
// Depois:
const { data: apiTeams = [] } = useTeams();
const teamNames = apiTeams.map((t) => t.name);
const teamsToShow = teamNames.length > 0 ? teamNames : TEAMS; // fallback enquanto carrega
const visibleTeams = technicianView ? teamsToShow.filter((t) => t === activeTeam) : teamsToShow;

const teamMembers = (teamName: string) => {
  const apiTeam = apiTeams.find((t) => t.name === teamName);
  if (apiTeam) return apiTeam.members.map((m) => m.name).join(", ");
  return technicians.filter((t) => t.team === teamName).map((t) => t.name).join(", ") || "Sem técnico";
};
```

- [ ] **Step 4: Interceptar o drop para abrir o modal em vez de atribuir direto**

Substitua a função `drop` existente:

```typescript
// Antes:
function drop(team: string) {
  if (dragBackendId) assignOrder.mutate({ id: dragBackendId, team });
  setDragCode(null);
  setDragBackendId(null);
  setOverTeam(null);
}
```

Por:

```typescript
// Depois:
function drop(teamName: string) {
  if (!dragBackendId || !dragCode) return;
  const order = orders.find((o) => o._backendId === dragBackendId);
  setPending({
    backendId: dragBackendId,
    code: dragCode,
    description: order?.description ?? "",
    teamName,
  });
  setDragCode(null);
  setDragBackendId(null);
  setOverTeam(null);
}

function confirmAssign(scheduledStart: string) {
  if (!pending) return;
  assignOrder.mutate(
    { id: pending.backendId, team: pending.teamName, scheduledStart },
    { onSuccess: () => setPending(null), onError: () => setPending(null) },
  );
}
```

- [ ] **Step 5: Adicionar barra de data e modal no JSX**

No `return` do `DispatchBoard`, substitua o wrapper externo:

```tsx
// Antes:
return (
  <div className="rounded-lg border border-line bg-panel p-5 shadow-[var(--shadow-panel)]">
    <SectionHeading eyebrow="Agenda das equipes" title="OS do dia e despacho" />
    <div className="flex gap-3">
      {/* ... resto */}
    </div>
  </div>
);
```

Por:

```tsx
// Depois:
return (
  <>
    <div className="rounded-lg border border-line bg-panel p-5 shadow-[var(--shadow-panel)]">
      {/* Header com data */}
      <div className="flex items-center justify-between mb-4">
        <SectionHeading eyebrow="Agenda das equipes" title="OS do dia e despacho" />
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setDate((d) => {
              const dt = new Date(d); dt.setDate(dt.getDate() - 1); return dt.toISOString().slice(0, 10);
            })}
            className="px-2 py-1 text-[11px] text-muted border border-line rounded hover:bg-surface transition-colors"
          >
            ‹
          </button>
          <span className="text-[12px] text-muted font-mono min-w-[90px] text-center">
            {new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
          </span>
          <button
            onClick={() => setDate((d) => {
              const dt = new Date(d); dt.setDate(dt.getDate() + 1); return dt.toISOString().slice(0, 10);
            })}
            className="px-2 py-1 text-[11px] text-muted border border-line rounded hover:bg-surface transition-colors"
          >
            ›
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        {/* Coluna de disponíveis */}
        {!technicianView && (
          <div className="shrink-0 w-[220px]">
            <KanbanColumn
              title="Disponíveis"
              subtitle="Arraste para uma equipe"
              orders={available}
              isOver={overTeam === "Sem equipe"}
              isEmpty
              onDragOver={(e) => { e.preventDefault(); setOverTeam("Sem equipe"); }}
              onDragLeave={() => setOverTeam((t) => (t === "Sem equipe" ? null : t))}
              onDrop={() => drop("Sem equipe")}
              onDragStart={startDrag}
              dragCode={dragCode}
            />
          </div>
        )}

        {/* Colunas de equipes */}
        <div className="flex-1 overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {visibleTeams.map((team) => {
              const teamOrders = sortOrders(
                orders.filter((o) => o.team === team && (!o.scheduledDate || o.scheduledDate === date))
              );
              return (
                <KanbanColumn
                  key={team}
                  title={team}
                  subtitle={teamMembers(team)}
                  orders={teamOrders}
                  isOver={overTeam === team}
                  isEmpty
                  onDragOver={(e) => { e.preventDefault(); setOverTeam(team); }}
                  onDragLeave={() => setOverTeam((t) => (t === team ? null : t))}
                  onDrop={() => drop(team)}
                  onDragStart={startDrag}
                  dragCode={dragCode}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>

    {pending && (
      <AssignModal
        osCode={pending.code}
        osDescription={pending.description}
        teamName={pending.teamName}
        onConfirm={confirmAssign}
        onCancel={() => setPending(null)}
        isPending={assignOrder.isPending}
      />
    )}
  </>
);
```

- [ ] **Step 6: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 7: Verificar build completo**

```bash
npm run build
```

Esperado: `✓ Compiled successfully`.

- [ ] **Step 8: Commit**

```bash
git add src/components/dashboard/dispatch-board.tsx
git commit -m "feat(dispatch): add date navigation, team API data and AssignModal to existing DispatchBoard"
```

---

## Self-Review — Cobertura

| Melhoria | Task | Arquivo modificado |
|---|---|---|
| Rota GET /api/teams | Task 1 | `teamRoutes.ts` (novo) + `app.ts` |
| useTeams hook | Task 2 | `useTeams.ts` (novo) |
| scheduledStart no adapter | Task 3 | `adapters.ts`, `types.ts`, `useServiceOrders.ts` |
| Modal de horário | Task 4 | `assign-modal.tsx` (novo) |
| Navegação de data no board | Task 5 | `dispatch-board.tsx` |
| Equipes reais da API | Task 5 | `dispatch-board.tsx` |
| Drop abre modal em vez de atribuir direto | Task 5 | `dispatch-board.tsx` |
| Filtro de OS por data selecionada | Task 5 | `dispatch-board.tsx` |
| Nenhum componente existente reescrito | ✅ | Apenas adições e edições pontuais |
