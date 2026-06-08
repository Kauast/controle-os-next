# Controle OS, Estoque e Agenda — Next.js

Recriação do sistema de **ordens de serviço, estoque com QR Code, agenda por equipes e app do técnico**, agora com uma stack moderna.

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS v4**
- **shadcn/ui** (componentes em `src/components/ui`)
- **TanStack Query** (relatórios e financeiro)
- **React Hook Form** + **Zod** (formulários e validação)
- **Zustand** (estado global com persistência em localStorage)
- **Framer Motion** (animações e transições)
- **lucide-react** (ícones)

## Funcionalidades

- 4 perfis (`admin`, `estoque`, `tecnico`, `atendimento`) com controle de acesso por seção
- Painel com indicadores em tempo real
- Agenda das equipes com **drag & drop** de OS, calendário mensal e agendamento
- Cadastro de OS em etapas (RHF + Zod) e fila priorizada
- Estoque: produtos, **QR Code**, entrada/saída, alertas de estoque baixo, histórico
- Solicitação e aprovação de material
- Relatórios por equipe e financeiro (somente admin) via TanStack Query
- Rastreamento das equipes em mapa simulado
- Gestão de equipes e técnicos
- **App do técnico** (`/tecnico`): check-in, 3 fotos, assinatura em canvas, ID do chip e
  finalização da OS (bloqueada até cumprir todos os requisitos)

## Rodando localmente

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). O app do técnico fica em `/tecnico`.

## Estrutura

```text
src/
  app/            # rotas (/ e /tecnico) + layout/globals
  components/
    ui/           # componentes shadcn/ui
    layout/       # sidebar e topbar
    dashboard/    # métricas, agenda, dispatch, fila de OS
    stock/        # estoque e QR
    reports/ finance/ tracking/ teams/ clients/ dialogs/
    tecnico/      # canvas de assinatura
  hooks/          # TanStack Query e helpers
  lib/            # tipos, seed, utils, regras de acesso, api mock
  store/          # Zustand (estado do app e da UI)
```

O estado começa com dados de exemplo (`src/lib/seed.ts`) e é persistido no navegador.
