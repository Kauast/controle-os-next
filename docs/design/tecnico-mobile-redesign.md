# Redesign Técnico em Campo — Guardião (Fase 1)

> **Status:** Especificação de design aprovada para implementação (Fase 2 — mobile-developer)
> **Branch:** `feat/redesign-tecnico-mobile`
> **Escopo:** 3 telas de `src/app/tecnico-mobile/` + design system base

---

## Sumário

1. [Princípios de Design](#1-princípios-de-design)
2. [Design Tokens (resumo)](#2-design-tokens-resumo)
3. [Componentes base polidos](#3-componentes-base-polidos)
4. [Tela 1 — Login](#4-tela-1--login)
5. [Tela 2 — Lista de OS (Home)](#5-tela-2--lista-de-os-home)
6. [Tela 3 — Execução de OS](#6-tela-3--execução-de-os)
7. [Comportamentos transversais](#7-comportamentos-transversais)
8. [Mapeamento de arquivos para Fase 2](#8-mapeamento-de-arquivos-para-fase-2)
9. [Checklist de acessibilidade](#9-checklist-de-acessibilidade)

---

## 1. Princípios de Design

| Princípio | Decisão de design |
|-----------|-------------------|
| **Uma mão / polegar** | Ações primárias ancoradas em `fixed bottom-0` ou na parte inferior da tela; header compacto no topo |
| **Legível ao ar livre** | Texto mínimo 13px; cores com contraste WCAG AA; nunca apenas cor para estado (cor + ícone + texto) |
| **Feedback tátil** | `active:scale-[0.97]` em todo elemento interativo; toasts via `sonner` para resultado de ação |
| **Resiliência visível** | Banner offline animado (altura 0 → auto com AnimatePresence); contador de sync sempre visível no header |
| **Safe areas** | `env(safe-area-inset-*)` aplicado em header, bottom sheet e footer; `viewport-fit=cover` já no layout |
| **Performance** | Nenhuma nova dependência; reutiliza framer-motion e lucide-react existentes |

---

## 2. Design Tokens (resumo)

Arquivo: `src/app/globals.css` — bloco `@theme`

### Paleta principal

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-background` | `#0B1220` | Canvas raiz |
| `--color-surface-0` | `#0d0d10` | Splash / scrim |
| `--color-surface-1` | `#111827` | Fundo de seção |
| `--color-surface-2` | `#1A2235` | Card secundário |
| `--color-surface-3` | `#1F2937` | Card elevado (panel) |
| `--color-surface-4` | `#243044` | Card ativo / hover |
| `--color-ink` | `#F0F2F5` | Texto primário |
| `--color-ink-secondary` | `#C8CDD8` | Texto secundário |
| `--color-muted` | `#8B95A7` | Texto suporte (≥ AA) |
| `--color-teal` | `#14B8A6` | Accent primário |
| `--color-teal-bright` | `#2DD4BF` | Teal hover |
| `--color-amber` | `#F59E0B` | Logo / identidade |
| `--color-red` | `#EF4444` | Erro / crítico |
| `--color-success` | `#22C55E` | Concluído |
| `--color-blue` | `#3B82F6` | OS aberta |
| `--color-orange` | `#F97316` | Aguardando peças |

### Raios

| Token | Valor | Uso |
|-------|-------|-----|
| `--radius-xs` | `8px` | Badge, pill |
| `--radius-sm` | `12px` | Input, botão, chip |
| `--radius-md` | `16px` | Card padrão |
| `--radius-lg` | `20px` | Card principal |
| `--radius-xl` | `24px` | Bottom sheet |

### Touch targets

| Token | Valor | Uso |
|-------|-------|-----|
| `--touch-md` | `44px` | Mínimo WCAG |
| `--touch-lg` | `52px` | Botão primário |
| `--touch-xl` | `56px` | CTA full-width |

### Sombras

| Token | Uso |
|-------|-----|
| `--shadow-sm` | Input, ícone |
| `--shadow-panel` | Card padrão |
| `--shadow-float` | Card elevated, modal inline |
| `--shadow-modal` | Bottom sheet |
| `--shadow-glow-teal` | Focus ring do botão primário |

---

## 3. Componentes base polidos

### `button.tsx`

- **Novo size `xl`** (h-14 / 56px) para CTAs full-width como "Finalizar OS" e "Iniciar atendimento"
- **Nova variante `amber`** para o botão de login (identidade Guardião)
- **Nova variante `outline`** para ações de confirmação bordadas em teal
- **Prop `isLoading`** — desabilita, aplica `cursor-wait` e `aria-busy`
- Touch target mínimo garantido em todos os sizes (min-h via token)
- Transição com `ease-spring` para feedback tátil natural

### `card.tsx`

- **Prop `tone`** — `default | teal | amber | red | blue | orange` para cards de status semântico
- **Prop `variant`** — `default | elevated | subtle | ghost` para hierarquia de elevação
- Padding `p-4` padrão (era `p-5`)
- `SectionHeading` com `text-[17px]` (mais legível que 18px anterior em mobile)

### `badge.tsx`

- **Prop `size`** — `sm | md | lg` (antes só havia tamanho único)
- **Novos tones** `blue` e `orange` para status completos de OS
- `[&_svg]:size-3` — aceita ícone lucide ao lado do texto
- Bordas sólidas com alpha leve (não apenas fundo suave)

### `input.tsx`

- **Altura h-12 (48px)** — touch target confortável, previne zoom iOS/Android em `font-size: 16px`
- **Prop `error`** — borda red + ring red
- `text-[15px]` fixo — previne auto-zoom em iOS quando `font-size < 16px`
- Placeholder em `--color-disabled` (mais legível que `muted/70`)

### `empty-state.tsx`

- **Prop `tone`** — `neutral | success | warn | error` com ícone colorido
- Ícone 16×16 (era 14) para melhor visibilidade
- `max-w-[260px]` — evita linhas longas em telas estreitas

### `stat-card.tsx`

- Animação com `ease: [0.16, 1, 0.3, 1]` (out-expo) — mais suave
- Delay entre cards `0.06s` (era `0.04s`) — hierarquia de entrada mais clara
- Valor em `text-[28px]` (era `2rem` = 32px) — compacto mas legível em grid 2 colunas

### `signature-pad.tsx`

- Fundo branco puro no canvas (contraste da tinta `#111827`)
- Altura `h-44 (176px)` — área maior para assinatura confortável
- `setPointerCapture` — sem perda de rastreamento ao mover rápido
- Badge "Confirmada" em teal com ícone
- Botões com ícones lucide (Trash2, CheckCircle2)

---

## 4. Tela 1 — Login

**Arquivo:** `src/app/tecnico-mobile/login/page.tsx`

### Wireframe

```
┌─────────────────────────────────────────┐
│           [safe-area-top]               │
│                                         │
│                                         │
│                                         │
│           ┌──────────┐                  │
│           │  SHIELD  │  ← LionShield    │
│           │  amber   │    64×64px       │
│           └──────────┘                  │
│                                         │
│           GUARDIÃO                      │
│           App do Técnico                │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  ┌───────────────────────────┐  │    │
│  │  │  E-mail                   │  │    │
│  │  │  [input 48px]             │  │    │
│  │  └───────────────────────────┘  │    │
│  │  ┌───────────────────────────┐  │    │
│  │  │  Senha                    │  │    │
│  │  │  [input 48px]      [👁]   │  │    │
│  │  └───────────────────────────┘  │    │
│  │                                  │    │
│  │  [!!] Mensagem de erro          │    │
│  │                                  │    │
│  │  [   ENTRAR   56px amber   ]    │    │
│  └─────────────────────────────────┘    │
│                                         │
│    Servidor: http://localhost:3333      │
│                                         │
│           [safe-area-bottom]            │
└─────────────────────────────────────────┘
```

### Especificação visual

**Layout:**
- `min-h-[100dvh]` com `flex flex-col items-center justify-center`
- `px-5` (20px) para margem lateral segura
- Fundo: `--color-surface-0` (`#0d0d10`) — splash idêntico ao Capacitor

**Logo:**
- `LionShield` — `size-16` (64×64px) — cor `--color-amber`
- `filter: drop-shadow(0 4px 16px rgba(245,158,11,0.35))` — glow âmbar sutil
- Espaço inferior `mb-6` (24px) até o card

**Tipografia:**
- "GUARDIÃO" — `text-[26px] font-bold tracking-tight text-ink`
- "App do Técnico" — `text-[13px] text-muted mt-0.5`

**Card do formulário:**
- `bg-[var(--color-surface-2)]` (`#1A2235`)
- `border border-[var(--color-line-strong)]`
- `rounded-[var(--radius-xl)]` (24px)
- `px-6 py-7`
- `w-full max-w-[360px]`

**Campos:**
- Usar `<Input>` do design system (h-12, 48px, text-15px)
- Campo senha: botão toggle show/hide no lado direito (44×44px, `variant="ghost" size="icon"`)
- `autoComplete="email"` e `autoComplete="current-password"` mantidos

**Estado de erro:**
- Banner interno ao card
- `bg-[var(--color-red-soft)] border border-[var(--color-red-border)] rounded-[var(--radius-sm)] px-4 py-3`
- Ícone `AlertCircle` (lucide, size-4, `text-[var(--color-red-bright)]`) + texto `text-[13px]`

**Botão principal:**
- `variant="amber" size="xl"` — `w-full h-14`
- Texto "Entrar" / "Entrando..." (com `isLoading`)
- Quando `isLoading`: adicionar `<RefreshCw className="size-4 animate-spin" />` à esquerda

**Rodapé do servidor:**
- Mantido como está — `text-[11px] text-[var(--color-disabled)]`
- `mt-8` do card

### Estados

| Estado | Visual |
|--------|--------|
| Idle | Card estático, botão amber habilitado |
| Loading | `isLoading` no botão, spinner animado, campos `disabled` |
| Erro | Banner vermelho no card, campos reabilitados |
| Sucesso | Transição via `router.replace` (sem feedback adicional) |

### Microinteração

- Entrada do card: `motion.div` com `initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}` `transition={{ duration: 0.3, ease: [0.16,1,0.3,1] }}`
- Banner de erro: `AnimatePresence` com `initial={{ height: 0, opacity: 0 }}`

---

## 5. Tela 2 — Lista de OS (Home)

**Arquivo:** `src/app/tecnico-mobile/page.tsx` (seção de listagem)

### Wireframe

```
┌─────────────────────────────────────────┐
│  [safe-area-top]                        │
│  ┌─────────────────────────────────┐    │ ← header sticky
│  │ [avatar]  TÉCNICO / MINHAS OS   │    │
│  │           [wifi] [sync] [logout] │    │
│  └─────────────────────────────────┘    │
│  [!! OFFLINE — ações salvas localmente] │ ← banner AnimatePresence
│                                         │
│  ── HOJE ── [RefreshCw Atualizar]       │
│                                         │
│  ┌────────┐ ┌────────┐ ┌────────┐      │ ← stats 3 colunas
│  │  3     │ │  1     │ │  2     │      │
│  │ Total  │ │Pendente│ │ Feitas │      │
│  └────────┘ └────────┘ └────────┘      │
│                                         │
│  ── ORDENS DE SERVIÇO ──                │
│                                         │
│  ┌─────────────────────────────────┐    │ ← OS card (OPEN)
│  │ [●] Aberta    #001 · Normal     │    │
│  │ Empresa ABC                     │    │
│  │ Instalação de câmera IP...      │    │
│  │ 08:00 · Rua X, São Paulo        │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │ ← OS card (IN_PROGRESS, ativo)
│  │ [●] Em andamento  #002 · Alta   │    │
│  │ Empresa XYZ          ← selecionado   │
│  │ Manutenção preventiva           │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │ ← OS card (COMPLETED)
│  │ [✓] Concluída  #003 · Normal    │    │
│  │ Empresa 123                     │    │
│  └─────────────────────────────────┘    │
│                                         │
│         [safe-area-bottom]              │
└─────────────────────────────────────────┘
```

### Header

```
┌──────────────────────────────────────────────────────────┐
│  [🛡] Avatar inicial  │  nome do técnico   [wifi] [42] [⎋] │
│       (teal, 36px)    │  "Minhas OS"       ícones header   │
└──────────────────────────────────────────────────────────┘
```

**Detalhes do header:**
- `sticky top-0 z-30`
- `bg-[var(--color-surface-0)]/95 backdrop-blur-md`
- `border-b border-[var(--color-line)]`
- `px-4` + `style={{ paddingTop: "max(12px, calc(env(safe-area-inset-top) + 4px))" }}`
- Altura total: ~56px + safe-area

**Avatar de inicial:**
- `div` 36×36px, `rounded-[var(--radius-sm)]`, `bg-[var(--color-teal-soft)]`, `border border-[var(--color-teal-border)]`
- Letra inicial do nome em `text-[13px] font-bold text-teal`
- Fallback: ícone `User` lucide

**Indicador de rede:**
- Online: `<Wifi className="size-[18px] text-teal" />` — sem label
- Offline: `<WifiOff className="size-[18px] text-[var(--color-red-bright)]" />`

**Badge de sync pendente:**
- `min-h-[32px] px-2.5 py-1` — touch target mínimo 40px via `min-w-[40px]`
- `bg-[var(--color-amber-soft)] border border-[var(--color-amber-border)] rounded-[var(--radius-xs)]`
- Ícone `Clock` ou `RefreshCw animate-spin` (quando sincronizando) + número
- `text-[11px] font-semibold text-amber`

**Botão Logout:**
- `variant="icon" size="icon"` (44×44px)

### Banner Offline

```
┌──────────────────────────────────────────────────────────┐
│  [WifiOff] Sem conexão — ações ficam salvas localmente.  │
└──────────────────────────────────────────────────────────┘
```

- Classe `.offline-banner` (definida em globals.css)
- `AnimatePresence` com `initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}`
- Ícone `WifiOff size-4` + `text-[13px] font-medium text-[var(--color-red-bright)]`

### Stats Grid (3 colunas no mobile)

```
┌──────────┐ ┌──────────┐ ┌──────────┐
│    3     │ │    1     │ │    2     │
│  Total   │ │Pendentes │ │ Feitas   │
└──────────┘ └──────────┘ └──────────┘
```

**Reduzido de 4 para 3 cards** — remove o card "Status" (a informação de rede já está no header).

- Grid: `grid grid-cols-3 gap-2`
- Usar `<StatCard>` com `index={0|1|2}` para animação em cascata
- Pendentes > 0: `warn` tone no card
- Concluídas = Total: `success` tone no card Feitas
- Total: sem tone especial

**Botão Atualizar:**
- `variant="ghost" size="sm"` — flutuante, centralizado, acima do grid
- Ícone `RefreshCw` com `animate-spin` quando carregando
- `text-[12px] text-muted`

### OS Cards

**Estrutura de cada card:**

```
┌─────────────────────────────────────────┐
│  [BADGE STATUS + ÍCONE]  #001 · Prioridade  │
│  Nome do Cliente (text-[15px] font-bold)    │
│  Descrição — line-clamp-1 (text-[13px])     │
│  [relógio] hora  [pin] endereço             │
└─────────────────────────────────────────┘
```

- `w-full rounded-[var(--radius-md)] border p-4 text-left`
- Transição: `transition-all duration-[200ms]`
- `active:scale-[0.99]` (press-effect leve)

**Card inativo:**
- `border-[var(--color-line)] bg-[var(--color-surface-2)]`
- hover: `bg-[var(--color-surface-3)] border-[var(--color-line-strong)]`

**Card ativo (OS selecionada / IN_PROGRESS):**
- `border-[var(--color-amber-border)] bg-[var(--color-amber-soft)]`
- Borda lateral esquerda destacada: `border-l-2 border-l-amber` (stripe de ênfase)

**Badge de status** (usa `<Badge>` do DS):

| Status | Tone | Ícone lucide |
|--------|------|-------------|
| OPEN | `blue` | `Clock` |
| IN_PROGRESS | `amber` | `Wrench` |
| WAITING_PARTS | `orange` | `Package` |
| COMPLETED | `teal` | `CheckCircle2` |
| CANCELLED | `red` | `XCircle` |

**Badge de prioridade:**

| Prioridade | Visual |
|------------|--------|
| NORMAL | texto muted sem badge |
| WARNING | `<Badge tone="amber" size="sm">Atenção</Badge>` |
| HIGH | `<Badge tone="orange" size="sm">Alta</Badge>` |
| CRITICAL | `<Badge tone="red" size="sm">Crítica</Badge>` |

**Metadados:**
- Hora criação: `<Clock className="size-3 text-muted" />` + texto `text-[11px] text-muted`
- Endereço: `<MapPin className="size-3 text-muted" />` + `text-[11px] text-muted line-clamp-1`

### Estado Vazio

```
┌─────────────────────────────────────────┐
│          [ClipboardList ícone]          │
│      Nenhuma OS atribuída hoje          │
│  Aguarde a atribuição pelo supervisor   │
│       [Atualizar lista — ghost]         │
└─────────────────────────────────────────┘
```

- Usar `<EmptyState tone="neutral">` com ícone `ClipboardList`
- Ação: `<Button variant="ghost" size="sm">Atualizar lista</Button>`

### Estado Loading (Skeleton)

- `<Skeleton>` — usar classe `skeleton` de globals.css (shimmer)
- Header: 1 skeleton de avatar 36px + 2 linhas de texto
- Stats: 3 retângulos `h-[68px]`
- Cards: 2 retângulos `h-[88px]`

---

## 6. Tela 3 — Execução de OS

**Arquivo:** `src/app/tecnico-mobile/page.tsx` (painel `AnimatePresence`)

Esta tela aparece abaixo da lista quando há uma OS ativa (não concluída/cancelada).

### Wireframe completo

```
┌─────────────────────────────────────────┐
│  ── HEADER STICKY (igual tela 2) ──     │
│                                         │
│  [lista de OS cards acima]              │
│                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                         │
│  ┌─────── CARD CLIENTE ─────────────┐   │
│  │ [BADGE] Em andamento  OS #002    │   │
│  │ Empresa XYZ (text-lg bold)       │   │
│  │ Manutenção preventiva em câmeras │   │
│  │ Rua X, 123 — São Paulo, SP       │   │
│  │                                  │   │
│  │ [📞 Ligar]    [🗺 Rota]          │   │
│  │                                  │   │
│  │ [   INICIAR ATENDIMENTO   56px ] │   │
│  │     ou [✓ Check-in realizado]    │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ┌─────── CARD CHECKLIST ───────────┐   │
│  │  Conclusão da OS        [BADGE]  │   │
│  │                                  │   │
│  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐    │   │
│  │  │ ✓  │ │ ○  │ │ ○  │ │ ○  │   │   │
│  │  │Check│ │Foto│ │Assi│ │Chip│   │   │
│  │  └────┘ └────┘ └────┘ └────┘    │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ┌─────── SEÇÃO FOTOS ──────────────┐   │
│  │  Registro fotográfico   1/3      │   │
│  │                                  │   │
│  │  ┌───────┐ ┌───────┐ ┌───────┐  │   │
│  │  │       │ │       │ │       │  │   │
│  │  │ ANTES │ │DURANTE│ │DEPOIS │  │   │
│  │  │[📷]   │ │ [📷]  │ │ [📷]  │  │   │
│  │  └───────┘ └───────┘ └───────┘  │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ┌─────── SEÇÃO ASSINATURA ─────────┐   │
│  │  SignaturePad                    │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ┌─────── SEÇÃO CHIP ───────────────┐   │
│  │  ID do Chip (ICCID)             │   │
│  │  [input 48px]                   │   │
│  │  [Confirmar chip — secondary]   │   │
│  │  ✓ Chip confirmado: 8955...     │   │
│  └──────────────────────────────────┘   │
│                                         │
│  [   FINALIZAR OS   56px — disabled]   │
│                                         │
│  [safe-area-bottom]                     │
└─────────────────────────────────────────┘
```

---

### Seção Card Cliente

**Layout e hierarquia:**

```
[BADGE status + ícone]   OS #002
Nome do Cliente                      ← text-[17px] font-bold text-ink
Descrição da OS                      ← text-[13px] text-muted (2 linhas max)
Endereço completo                    ← text-[11px] text-muted
```

**Botões de ação rápida:**
- Container: `grid grid-cols-2 gap-2 mt-3`
- `<Button variant="secondary" size="default">` com ícone + texto
- Ambos `asChild` envolvendo `<a href>` para tel: e maps

**Botão Check-in:**
- `variant="primary" size="xl" className="w-full mt-3"`
- Estado: "Iniciar atendimento" (idle) → `isLoading` com spinner (carregando GPS) → "Check-in realizado" (done, disabled, `variant="outline"`)
- Quando `checkedIn`: `<CheckCircle2 className="size-5 text-teal" />` + texto "Check-in realizado"
- Card inteiro com `tone="teal" variant="elevated"` após check-in

---

### Seção Checklist (4 itens)

Barra de progresso visual acima dos items:

```
Progresso: ░░░░  1 de 4 etapas
[━━━━━━━━━━░░░░░░░░░░░░░░░░░░░░░] 25%
```

- `div` com `h-1.5 rounded-full bg-[var(--color-line)]` + inner `div` com `style={{ width: "25%" }}` e `bg-teal transition-all duration-500`

**Grid de items (2×2):**

```
┌─────────────────┐ ┌─────────────────┐
│ [✓] Check-in    │ │ [○] 3 Fotos     │
│  concluído      │ │  pendente       │
└─────────────────┘ └─────────────────┘
┌─────────────────┐ ┌─────────────────┐
│ [○] Assinatura  │ │ [○] ID do Chip  │
│  pendente       │ │  pendente       │
└─────────────────┘ └─────────────────┘
```

- Item concluído: `border-[var(--color-teal-border)] bg-[var(--color-teal-soft)] text-teal`
  - Ícone: `<CheckCircle2 className="size-4 text-teal" />`
- Item pendente: `border-[var(--color-line)] bg-[var(--color-surface-2)] text-muted`
  - Ícone: `<Circle className="size-4 text-[var(--color-disabled)]" />`
- Texto: `text-[12px] font-medium`
- Height: `min-h-[52px]` — touch target

**Badge de status geral (canto superior direito):**
- Todos prontos: `<Badge tone="teal">Liberado</Badge>`
- Pendente: `<Badge tone="amber">Pendente</Badge>`

---

### Seção Fotos

**Cabeçalho:**
- `text-[13px] font-semibold text-ink` + contador `text-[11px] text-muted`

**Grid de 3 slots (fotos: Antes, Durante, Depois):**

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│             │ │   <img>     │ │             │
│   [📷]      │ │  preview    │ │   [📷]      │
│             │ │  ┌──────┐   │ │             │
│    ANTES    │ │  │ [✓]  │   │ │   DEPOIS    │
└─────────────┘ └──────────────┘ └─────────────┘
  ─ pendente ─    ─ enviado ─    ─ pendente ─
```

- `aspect-square rounded-[var(--radius-md)] overflow-hidden`
- `border-2 border-dashed`
- Estado vazio: `border-[var(--color-line-strong)] bg-[var(--color-surface-2)]`
- Estado com preview: `border-transparent` + `<img>` absolute fill
- Estado uploading: overlay `bg-[var(--color-surface-0)]/70` + `<RefreshCw animate-spin text-white>`
- Estado enviado: `border-[var(--color-teal-border)]` + badge `<CheckCircle2>` canto superior direito
- Estado erro: overlay `bg-[var(--color-red-soft)]/80` + `<AlertCircle text-[var(--color-red-bright)]>` centralizado + texto "Toque para tentar novamente"
- Label do slot: `absolute bottom-1.5` com `text-[10px] font-bold text-white drop-shadow` (visível sobre qualquer fundo)

**Toque no slot:** abre câmera (via `capturePhoto`) — lógica existente mantida.

---

### Seção Assinatura

- Usar `<SignaturePad>` refatorado (ver seção 3)
- `value={signature.preview ?? null}` mantido
- Badge de upload: `<RefreshCw animate-spin text-amber>` + "Salvando assinatura..." quando `signature.uploading`
- Após confirmar: badge "Confirmada" aparece no header do pad

---

### Seção Chip ICCID

**Card próprio:**
- `<Card variant="subtle">` (surface-2, sombra leve)
- Label: "ID do Chip (ICCID)"
- `<Input>` com `inputMode="numeric"`, `placeholder="89 5504 1234 5678 9012"`, `error={chipDraft.length > 0 && chipDraft.replace(/\D/g,"").length < 5}`
- Botão: `<Button variant="outline" size="default" className="w-full mt-2" disabled={!chipDraft.trim() || updateExecution.isPending}>`
  - Ícone `<BadgeCheck>` + "Confirmar chip"

**Estado confirmado:**
```
┌─────────────────────────────────────────┐
│  [✓] Chip confirmado:  8955041234567890 │
└─────────────────────────────────────────┘
```
- `text-[12px]` + `<CheckCircle2 size-3.5 text-teal>` + texto `text-teal`

---

### Botão Finalizar OS

**Posição:** Final do scroll, dentro do card de execução.

```
┌──────────────────────────────────────────┐
│         FINALIZAR OS        ← 56px      │
│  (disabled até checklist completo)       │
└──────────────────────────────────────────┘
```

- `<Button variant="primary" size="xl" className="w-full" disabled={!canFinish || completeOS.isPending}>`
- Estado `isPending`: `isLoading + spinner + "Finalizando..."`
- Estado `disabled` (checklist incompleto): `opacity-45`, cursor-not-allowed, sem feedback de toque

**Hint visual quando desabilitado:**
- Abaixo do botão: `<p className="text-center text-[11px] text-muted mt-2">Complete todas as etapas para finalizar</p>`
- Oculto quando `canFinish === true`

---

### Estado OS Concluída

```
┌─────────────────────────────────────────┐
│                                         │
│         [CheckCircle2 — 56px teal]      │
│                                         │
│          OS #002 Concluída!             │
│    Empresa XYZ — atendimento encerrado  │
│                                         │
│         [Ver outras OS — secondary]     │
│                                         │
└─────────────────────────────────────────┘
```

- `<Card tone="teal" variant="elevated">` com `text-center p-8`
- Ícone `<CheckCircle2 className="mx-auto mb-3 size-14 text-teal" />`
- `motion.div` com `initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}` `transition={{ duration: 0.3, ease: [0.34,1.56,0.64,1] }}`

---

## 7. Comportamentos transversais

### Animações (framer-motion)

| Elemento | Animação |
|----------|----------|
| Entrada de cards da lista | `initial={{ opacity: 0, y: 8 }}`, delay staggerado `index * 0.05s` |
| Painel de execução (aparece/some) | `initial={{ opacity: 0, y: 12 }}`, mode="wait" |
| Banner offline | `initial={{ height: 0, opacity: 0 }}`, `overflow-hidden` |
| OS Concluída | `initial={{ opacity: 0, scale: 0.92 }}` com ease spring |
| Stats cards | `initial={{ opacity: 0, y: 8 }}`, delay por index |
| Checklist item (done → undone) | `transition-all duration-200` nas classes do bg |

### Toasts (sonner)

| Evento | Toast | Duração |
|--------|-------|---------|
| Check-in realizado | `toast.success("Check-in realizado!")` | padrão |
| Check-in erro | `toast.error("Erro ao fazer check-in. Tente novamente.")` | padrão |
| Foto erro | `toast.error("Erro ao enviar foto. Toque no slot para tentar novamente.")` | 4s |
| Assinatura erro | `toast.error("Erro ao salvar assinatura.")` | padrão |
| Chip confirmado | `toast.success("Chip confirmado!")` | padrão |
| OS finalizada | `toast.success("OS finalizada com sucesso!")` | 4s |
| Sync: X sincronizadas | `toast.success(...)` | padrão |
| Sync: X falharam | `toast.error(...)` | padrão |
| Sync offline | `toast.error("Sem conexão. Aguardando rede.")` | padrão |

### Skeleton Loading

Classe `.skeleton` (definida em globals.css — shimmer lateral).

| Elemento | Skeleton |
|----------|----------|
| Avatar header | `skeleton size-9 rounded-[var(--radius-sm)]` |
| Nome / subtítulo | `skeleton h-3 w-24` + `skeleton h-4 w-32` |
| Stats | `skeleton h-[68px] rounded-[var(--radius-md)]` × 3 |
| OS Card | `skeleton h-[88px] rounded-[var(--radius-md)]` × 2 |

---

## 8. Mapeamento de arquivos para Fase 2

O mobile-developer deve implementar **somente** as mudanças visuais listadas abaixo. A lógica de dados e hooks NÃO deve ser alterada.

### Arquivos a editar

| Arquivo | O que implementar |
|---------|-------------------|
| `src/app/tecnico-mobile/login/page.tsx` | Substituir inputs/button por componentes do DS; adicionar animação de entrada; toggle de senha; AnimatePresence no erro |
| `src/app/tecnico-mobile/page.tsx` | Refatorar header (avatar de inicial, badges de status); mudar stats de 4 para 3 cards; refatorar OS cards (Badge com ícone, borda stripe no ativo); adicionar progress bar no checklist; refatorar foto slots (estados visuais completos); substituir card de chip por `<Card variant="subtle">`; refatorar botão Finalizar para size="xl"; adicionar hint text quando disabled; refatorar estado concluída |
| `src/components/ui/button.tsx` | **Já feito na Fase 1** |
| `src/components/ui/card.tsx` | **Já feito na Fase 1** |
| `src/components/ui/badge.tsx` | **Já feito na Fase 1** |
| `src/components/ui/input.tsx` | **Já feito na Fase 1** |
| `src/components/ui/label.tsx` | **Já feito na Fase 1** |
| `src/components/ui/empty-state.tsx` | **Já feito na Fase 1** |
| `src/components/ui/stat-card.tsx` | **Já feito na Fase 1** |
| `src/components/tecnico/signature-pad.tsx` | **Já feito na Fase 1** |
| `src/app/globals.css` | **Já feito na Fase 1** |

### NÃO alterar na Fase 2

- `src/hooks/useServiceOrdersMobile.ts`
- `src/lib/mobile/*`
- `src/lib/api/mobile-client.ts`
- `src/app/tecnico-mobile/layout.tsx`
- `capacitor.config.ts`
- `next.config.mobile.ts`

### Ícones lucide a importar (além dos já existentes)

```tsx
import {
  AlertCircle,     // erro genérico
  BadgeCheck,      // chip confirmado (já existe)
  Camera,          // foto slot (já existe)
  CheckCircle2,    // item done (já existe)
  Circle,          // item pendente (novo)
  ClipboardList,   // empty state de OS
  Clock,           // OS aberta / sync
  Eye, EyeOff,     // toggle senha no login
  LogOut,          // logout (já existe)
  MapPin,          // endereço (já existe)
  Package,         // WAITING_PARTS
  Phone,           // ligar (já existe)
  RefreshCw,       // sync / loading (já existe)
  Trash2,          // limpar assinatura (já no pad)
  User,            // fallback avatar
  Wifi, WifiOff,   // rede (já existem)
  Wrench,          // IN_PROGRESS
  XCircle,         // CANCELLED
} from "lucide-react";
```

---

## 9. Checklist de acessibilidade

- [ ] Todos os alvos de toque ≥ 44×44px (WCAG 2.5.5)
- [ ] Contraste de texto ≥ 4.5:1 para texto normal, ≥ 3:1 para texto grande (WCAG 1.4.3)
- [ ] Status de OS comunicado por cor + ícone + texto (não só cor) (WCAG 1.4.1)
- [ ] Estados disabled com `aria-disabled` ou atributo `disabled` nativo
- [ ] Botões com isLoading têm `aria-busy="true"`
- [ ] Campos obrigatórios com `required` (já no login)
- [ ] Banner offline acessível via `role="status"` ou `aria-live="polite"`
- [ ] Focus order lógico — sem salto visual
- [ ] `lang="pt-BR"` no HTML raiz (verificar `src/app/layout.tsx`)
- [ ] Canvas de assinatura: `aria-label="Área de assinatura do cliente"` no elemento canvas
- [ ] Toasts com duração ≥ 3s para usuários de leitores de tela
