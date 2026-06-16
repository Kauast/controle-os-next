# Design Spec — Dispatch Board

**Data:** 2026-06-15  
**Projeto:** controle-os-next (RB Segurança)  
**Status:** Aprovado para implementação

---

## Resumo

Tela de despacho estilo ServiceTitan: fila de OSs pendentes à esquerda + calendário de equipes à direita, numa única tela integrada. Objetivo: despachante consegue ver, atribuir e agendar OSs em segundos, com atualizações em tempo real refletidas no app mobile dos técnicos.

---

## Decisões de Design

### Layout geral
- Painel esquerdo fixo (220px): fila de OSs pendentes, ordenadas por prioridade (crítica → alta → média → baixa)
- Painel direito (flex): calendário com colunas por equipe e linhas por horário
- Topbar: navegação de data (← →), toggle Dia / Semana, data atual em destaque

### Unidade do calendário
- **Coluna = equipe** (não técnico individual)
- Cada coluna exibe: nome da equipe, nomes dos 2 técnicos, indicador de status online (verde/amarelo)
- Número de equipes: variável — colunas com scroll horizontal quando necessário

### Granularidade de tempo
- **Visão Dia** (padrão): slots de 1h, 07:00–19:00, todas as equipes visíveis simultaneamente
- **Visão Semana**: colunas = dias da semana (Seg–Sex), uma equipe selecionada por vez
- Toggle no topo direito alterna entre as visões

### Card de OS na fila
- Número da OS (`#147`)
- Título do problema (`Alarme sem sinal`)
- Cliente + bairro (`Cliente Araújo · Zona Sul`)
- Badge de prioridade com cor de borda esquerda:
  - Crítica → vermelho (`#ef4444`)
  - Alta → âmbar (`#f59e0b`)
  - Média → azul (`#3b82f6`)
  - Baixa → cinza (`#6b7280`)

### Card de OS no calendário
- Número + título abreviado
- Borda esquerda colorida por prioridade
- Ocupa o slot de horário correspondente (altura proporcional à duração estimada)

### Drag-and-drop
- Biblioteca: **dnd-kit** (`@dnd-kit/core` + `@dnd-kit/sortable`)
- Fonte (draggable): cards na fila de OSs pendentes
- Destino (droppable): qualquer slot de horário em qualquer coluna de equipe
- Ao soltar: abre **mini modal de confirmação** com:
  - Equipe selecionada
  - Horário sugerido (próximo slot livre da equipe)
  - Input para ajuste manual do horário
  - Botão "Confirmar despacho"
- Ao confirmar: OS sai da fila, aparece no calendário, notificação push enviada

### Realtime
- **Supabase Realtime** (já disponível na VPS self-hosted)
- Canal: `dispatch:date:<YYYY-MM-DD>`
- Eventos: `os_assigned`, `os_reassigned`, `os_cancelled`
- Todos os clientes conectados (outros despachantes) recebem o update instantaneamente sem refresh

### Notificação push para técnicos
- Ao confirmar despacho → backend envia push notification via **Expo Push API** (Capacitor/Expo)
- Payload: número OS, título, endereço, horário agendado
- App mobile (já existente) exibe a OS na lista do técnico em tempo real

### Multiplataforma
- **Web** (Next.js): tela completa `/despacho` acessível para roles `ADMIN` e `ATTENDANT`
- **Mobile** (Capacitor): técnico recebe notificação push + vê OSs atribuídas na tela existente de lista do dia — sem nova tela no mobile

---

## Arquitetura de Componentes

```
src/app/(dashboard)/despacho/page.tsx
  └── <DispatchBoard>
        ├── <DispatchTopbar>           ← data, toggle dia/semana, navegação
        ├── <OsQueue>                  ← fila de pendentes (DndContext source)
        │     └── <OsQueueCard>        ← draggable
        └── <TeamCalendar>             ← grid de equipes × horários
              ├── <TeamHeader>         ← nome da equipe, técnicos, status
              ├── <TimeSlot>           ← droppable
              └── <CalendarOsCard>     ← OS já agendada
```

```
src/components/dispatch/
  ├── DispatchBoard.tsx
  ├── DispatchTopbar.tsx
  ├── OsQueue.tsx
  ├── OsQueueCard.tsx
  ├── TeamCalendar.tsx
  ├── TeamHeader.tsx
  ├── TimeSlot.tsx
  ├── CalendarOsCard.tsx
  └── AssignModal.tsx                  ← mini modal de confirmação
```

---

## Backend (backend-senior/)

### Novos endpoints necessários
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/dispatch/board?date=YYYY-MM-DD` | OSs agendadas por equipe no dia |
| `GET` | `/api/dispatch/queue` | OSs pendentes (sem equipe/horário) |
| `POST` | `/api/dispatch/assign` | Atribuir OS a equipe + horário |
| `PATCH` | `/api/dispatch/assign/:id` | Reagendar OS já atribuída |

### Campos novos no modelo ServiceOrder (Prisma)
```prisma
teamId        String?   // FK para Team
scheduledAt   DateTime? // horário agendado
assignedBy    String?   // userId do despachante
assignedAt    DateTime? // timestamp do despacho
```

### Novo modelo Team
```prisma
model Team {
  id          String    @id @default(cuid())
  name        String
  technicians User[]    @relation("TeamMembers")
  serviceOrders ServiceOrder[]
  createdAt   DateTime  @default(now())
}
```

---

## Fluxo de dados

```
Despachante arrasta OS → dnd-kit onDrop
  → abre AssignModal (horário sugerido)
  → confirma → POST /api/dispatch/assign
    → backend salva teamId + scheduledAt
    → Supabase Realtime broadcast os_assigned
    → Expo Push Notification → técnico mobile
  → frontend remove OS da fila
  → frontend adiciona OS no slot do calendário
```

---

## Fora do escopo (v1)

- Mapa de técnicos em tempo real no board
- Drag entre slots já ocupados (reagendamento por drag)
- Filtros por região/bairro na fila
- Estimativa automática de duração da OS
- Notificação WhatsApp (fase 2)
