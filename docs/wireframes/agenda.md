# Wireframe — Agenda / Despacho

## Referência visual
ServiceTitan (dispatch board) + Housecall Pro + Jobber

---

## Layout principal

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER: "Agenda" │ [← Semana anterior] [Hoje] [Semana seguinte →]│
│                  │ [Dia] [Semana] [Mês]   [+ Nova OS]           │
├──────────────────┴──────────────────────────────────────────────┤
│ FILTROS: [Todos técnicos ▼] [Todos status ▼] [Tipo de OS ▼]    │
├─────────────────────────────────────────────────────────────────┤
│         │ SEG 09  │ TER 10  │ QUA 11  │ QUI 12  │ SEX 13       │
│ ────────┼─────────┼─────────┼─────────┼─────────┼──────────    │
│ 08:00   │         │         │         │         │              │
│ ────────│ ┌──────┐│         │ ┌──────┐│         │              │
│ 09:00   │ │OS142 ││         │ │OS150 ││         │              │
│         │ │Carlos││         │ │Ana   ││         │              │
│         │ │🟡Aber││         │ │🟢Conc││         │              │
│ ────────│ └──────┘│ ┌──────┐│ └──────┘│         │              │
│ 10:00   │         │ │OS145 ││         │ ┌──────┐ │              │
│         │         │ │Pedro ││         │ │OS155 │ │              │
│         │         │ │🔵And.││         │ │Carlos│ │              │
│ ────────│         │ └──────┘│         │ └──────┘ │              │
│ 11:00   │         │         │         │         │              │
├─────────────────────────────────────────────────────────────────┤
│ PAINEL LATERAL (OSs sem horário / fila)                         │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ Fila de despacho (3 OSs aguardando)                       │   │
│ │ OS #143 — Maria Ltda — Corretiva — ⚠️ Alta prioridade    │   │
│ │ OS #144 — ABC Corp — Preventiva — Normal                  │   │
│ │ [Arraste para agendar]                                    │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Componentes obrigatórios

1. **Header com navegação temporal** — semana anterior/próxima, botão "Hoje"
2. **Alternância de visão** — Dia / Semana / Mês
3. **Filtros** — por técnico, status, tipo de OS
4. **Dispatch board** — grade por hora x técnico com drag-and-drop
5. **Fila de despacho** — OSs abertas aguardando atribuição
6. **Card de OS** — nome do cliente, técnico, status colorido

---

## Interações

| Ação | Como |
|---|---|
| Criar nova OS | Clique em slot vazio na grade → modal de criação |
| Reatribuir OS | Arrastar card para outro técnico/horário |
| Ver detalhes | Clique no card → painel lateral com detalhes |
| Despachar da fila | Arrastar da fila para a grade |
| Mudar status | Dropdown inline no card |

---

## Regras específicas

- Conflito de horário exibe aviso visual (borda vermelha no card)
- OSs atrasadas têm card com fundo vermelho suave
- Técnico offline/sem check-in aparece com opacidade reduzida
- Drag-and-drop salva automaticamente via PATCH na API
- Notificação push ao técnico ao ser designado
