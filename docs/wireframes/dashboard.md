# Wireframe — Dashboard

## Referência visual
Linear + Stripe Dashboard + Datadog

---

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ SIDEBAR    │  HEADER: "Dashboard" + data atual + avatar          │
│            ├────────────────────────────────────────────────────┤
│ Dashboard  │  KPIs (linha 1)                                     │
│ Ordens     │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐ │
│ Clientes   │  │ OSs Hoje │ │Em Aberto │ │Concluídas│ │Atraso │ │
│ Estoque    │  │    12    │ │    5     │ │    7     │ │   2   │ │
│ Agenda     │  │ +3 ontem │ │ ⚠ 1 crit │ │ ✓ 58%    │ │  🔴   │ │
│ Financeiro │  └──────────┘ └──────────┘ └──────────┘ └───────┘ │
│ Rastreamen │                                                     │
│ Relatórios │  KPIs (linha 2)                                     │
│            │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐ │
│ ──────────  │  │T.M.Atend.│ │Técnicos  │ │Estoque   │ │Fatura.│ │
│ Config     │  │  2h 14m  │ │ 4/6 ativ │ │ 3 baixos │ │R$12k  │ │
│            │  └──────────┘ └──────────┘ └──────────┘ └───────┘ │
│            │                                                     │
│            │  ┌──────────────────────────┐ ┌───────────────────┐│
│            │  │ Gráfico OSs (7 dias)     │ │ Alertas           ││
│            │  │                          │ │ ─────────────────  ││
│            │  │  [linha de tendência]    │ │ 🔴 OS #142 atraso  ││
│            │  │                          │ │ ⚠️  Estoque mínimo ││
│            │  └──────────────────────────┘ │ ⚠️  Técnico sem    ││
│            │                               │    check-in        ││
│            │  Últimas OSs                  └───────────────────┘│
│            │  ┌─────────────────────────────────────────────────┐│
│            │  │ # │ Cliente    │ Tipo    │ Técnico │ Status │ ⋯ ││
│            │  │───│────────────│─────────│─────────│────────│───││
│            │  │142│ João Silva │Corretiva│ Carlos  │ 🔴Atras│ → ││
│            │  │141│ Maria Ltda │Preventiv│ Pedro   │ 🟡Andan│ → ││
│            │  │140│ ABC Corp   │Instalação│ Ana    │ 🟢Concl│ → ││
│            │  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Componentes obrigatórios

1. **KPI Cards (linha 1)** — OSs hoje, em aberto, concluídas, em atraso
2. **KPI Cards (linha 2)** — Tempo médio, técnicos ativos, alertas de estoque, faturamento do mês
3. **Gráfico de tendência** — OSs abertas vs concluídas nos últimos 7 dias
4. **Painel de alertas** — Itens críticos que exigem ação imediata
5. **Tabela de últimas OSs** — Top 10 mais recentes com ação inline

---

## Status de OS (cores obrigatórias)

| Status | Cor | Badge |
|---|---|---|
| Aberta | Amber `#fbbf24` | `🟡 Aberta` |
| Despachada | Teal `#14b8a6` | `🔵 Despachada` |
| Em andamento | Blue `#3b82f6` | `🔵 Em andamento` |
| Concluída | Green `#22c55e` | `🟢 Concluída` |
| Atrasada | Red `#ef4444` | `🔴 Atrasada` |
| Cancelada | Gray `#71717a` | `⚫ Cancelada` |

---

## Regras específicas

- KPIs de atraso e críticos sempre em destaque vermelho
- Clique no KPI card navega direto para a listagem filtrada
- Gráfico com tooltip ao hover mostrando valor exato
- Tabela com paginação de 10 itens + botão "ver todas"
- Alertas desaparecem quando resolvidos (tempo real via websocket)
