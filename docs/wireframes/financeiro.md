# Wireframe — Financeiro

## Referência visual
Stripe Dashboard + Grafana

---

## Layout principal

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER: "Financeiro"     [Filtro de período: Junho 2026 ▼]      │
├─────────────────────────────────────────────────────────────────┤
│ KPIs do mês                                                     │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐  │
│ │ Faturado   │ │ Recebido   │ │ A receber  │ │ Ticket médio │  │
│ │ R$ 38.400  │ │ R$ 28.900  │ │ R$ 9.500   │ │   R$ 480     │  │
│ │ +12% mês   │ │ 75% fatur. │ │ 3 em abers │ │              │  │
│ └────────────┘ └────────────┘ └────────────┘ └──────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────┐ ┌───────────────────────┐  │
│ │ Gráfico faturamento (30 dias)    │ │ Top clientes (mês)    │  │
│ │  [barras diárias]                │ │ 1. ABC Corp  R$ 8.200 │  │
│ │                                  │ │ 2. João S.   R$ 4.100 │  │
│ │                                  │ │ 3. XYZ Ltda  R$ 3.800 │  │
│ └──────────────────────────────────┘ └───────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│ TABS: [Cobranças] [Recebimentos] [Comissões] [Relatório]        │
├─────────────────────────────────────────────────────────────────┤
│ FILTROS: [🔍 Buscar cliente...] [Status ▼]  [Exportar Excel]    │
├─────────────────────────────────────────────────────────────────┤
│ OS   │ Cliente        │ Serviço     │ Valor   │ Status    │  ⋯  │
│──────│────────────────│─────────────│─────────│───────────│─────│
│ #140 │ ABC Corp       │ Preventiva  │ R$ 800  │ 🟢 Pago   │  ⋯  │
│ #141 │ Maria Ltda     │ Corretiva   │ R$ 350  │ 🟡 Pendent│  ⋯  │
│ #142 │ João Silva     │ Instalação  │ R$ 2.400│ 🔴 Atrasad│  ⋯  │
│ ...                                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tab — Comissões

```
┌─────────────────────────────────────────────────────────────────┐
│ Comissões — Junho 2026                                          │
├──────────────┬────────────┬──────────────┬─────────────────────┤
│ Técnico      │ OSs concl. │ Faturado     │ Comissão (10%)      │
├──────────────┼────────────┼──────────────┼─────────────────────┤
│ Carlos       │ 24         │ R$ 9.600     │ R$ 960              │
│ Pedro        │ 18         │ R$ 7.200     │ R$ 720              │
│ Ana          │ 21         │ R$ 8.400     │ R$ 840              │
└──────────────┴────────────┴──────────────┴─────────────────────┘
```

---

## Componentes obrigatórios

1. **KPI cards no topo** — faturado, recebido, a receber, ticket médio
2. **Gráfico de faturamento** — barras diárias dos últimos 30 dias
3. **Ranking de clientes** — top clientes do período
4. **Tabela de cobranças** — com status colorido e ações inline
5. **Tab de comissões** — produtividade e comissão por técnico

---

## Ações inline por linha

- Ver OS vinculada
- Marcar como pago
- Enviar lembrete (WhatsApp)
- Gerar boleto/PIX
- Editar valor

---

## Regras específicas

- Cobranças atrasadas (> 30 dias) sempre em vermelho
- Filtro de período com atalhos: hoje, 7 dias, 30 dias, este mês, custom
- Exportação em Excel e PDF disponível em todas as tabs
- Totais sempre visíveis no rodapé da tabela (não precisa scrollar)
- Porcentagem de recebimento vs faturado visível nos KPIs
