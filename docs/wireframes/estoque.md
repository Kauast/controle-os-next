# Wireframe — Estoque

## Referência visual
Odoo + ERPNext

---

## Layout principal

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER: "Estoque"                           [+ Entrada] [+ Saída]│
├─────────────────────────────────────────────────────────────────┤
│ TABS: [Itens] [Movimentações] [Alertas (3)] [QR Code]           │
├─────────────────────────────────────────────────────────────────┤
│ KPIs                                                            │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│ │Total itens│ │Abaixo min│ │Moviment. │ │ Valor total       │  │
│ │   127    │ │ 3 itens  │ │  hoje 18 │ │   R$ 24.380       │  │
│ └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│ FILTROS: [🔍 Buscar item...] [Categoria ▼] [Status ▼] [Local ▼] │
├─────────────────────────────────────────────────────────────────┤
│ Código  │ Item           │ Categoria   │ Qtd │ Mín │ Status │ ⋯ │
│ ────────│────────────────│─────────────│─────│─────│────────│───│
│ CAB-001 │ Cabo coax RG6  │ Cabeamento  │  45 │  20 │ 🟢 OK  │ ⋯ │
│ CAM-005 │ Câmera HD 1080 │ Câmeras     │   3 │   5 │ 🔴 Min │ ⋯ │
│ DVR-002 │ DVR 8 canais   │ Gravadores  │   8 │   2 │ 🟢 OK  │ ⋯ │
│ FIO-010 │ Fio 4x0.50     │ Cabeamento  │  12 │  30 │ 🔴 Min │ ⋯ │
│ ...                                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Modal de entrada/saída

```
┌──────────────────────────────────────────────────┐
│ Nova Movimentação                           [✕]  │
├──────────────────────────────────────────────────┤
│ Tipo:  ● Entrada  ○ Saída                        │
│                                                  │
│ Item:  [Buscar por nome ou QR Code...]  [📷 QR]  │
│                                                  │
│ Quantidade: [___]                                │
│                                                  │
│ OS vinculada: [Buscar OS... opcional]            │
│                                                  │
│ Observação: [___________________________]        │
│                                                  │
│             [Cancelar]  [Registrar movimentação] │
└──────────────────────────────────────────────────┘
```

---

## Tab — Alertas

- Lista de itens abaixo do estoque mínimo
- Botão de "Solicitar reposição" por item
- Histórico de alertas anteriores

## Tab — QR Code

- Câmera para leitura de QR Code
- Identifica item automaticamente
- Fluxo rápido: leu → quantidade → confirmar

---

## Regras específicas

- Items abaixo do mínimo sempre com badge vermelho
- Coluna de status sempre visível (não colapsada)
- Busca em tempo real na tabela (sem reload)
- Histórico de movimentações vinculado à OS que consumiu
- Exportar inventário em Excel com um clique
- Estoque por almoxarifado E por veículo técnico
