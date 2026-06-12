# Regras de UX — Obrigatórias

## Princípios fundamentais

Toda tela deve responder às três perguntas:
1. **O que está acontecendo?** — estado atual do sistema
2. **O que exige atenção?** — alertas, prazos, pendências
3. **Qual ação tomar?** — próximo passo óbvio

---

## Regras de layout

- Nunca criar páginas vazias.
- Sempre ocupar pelo menos **70% da tela** com conteúdo relevante.
- Nenhuma tela pode ter um único card centralizado sem contexto ao redor.
- Sidebar sempre visível em desktop. Collapsível em mobile.

---

## O que evitar

| Proibido | Motivo |
|---|---|
| Espaço morto | Desperdiça atenção do operador |
| Cards gigantes com pouca info | Baixa densidade de informação |
| Tabelas sem filtros | Inutiliza listas longas |
| Modais para ações simples | Interrompe o fluxo |
| Confirmar antes de cada ação | Lento para operações rotineiras |
| Textos genéricos ("dados do sistema") | Sem valor operacional |

---

## O que priorizar

| Prioridade | Como aplicar |
|---|---|
| Produtividade operacional | KPIs visíveis no topo de cada tela |
| Menos cliques | Ações primárias sempre visíveis, sem dropdowns desnecessários |
| Ações rápidas | Botões de ação contextual em cada linha de tabela |
| Densidade de informação | Usar tabelas compactas, não cards para listas |
| Feedback imediato | Toast de confirmação para toda ação |

---

## Regras por tipo de tela

### Dashboard / Home
- Mínimo 6 KPIs visíveis
- Gráfico de tendência (últimos 7 ou 30 dias)
- Lista das últimas OSs com status colorido
- Alertas e pendências em destaque

### Listagens (Tabelas)
- Filtro obrigatório no topo
- Busca em tempo real
- Ações inline por linha (editar, ver, excluir)
- Paginação ou scroll infinito
- Coluna de status sempre com badge colorido

### Formulários
- Validação em tempo real (não só no submit)
- Campos agrupados por seção
- Progress indicator para formulários longos
- Botão de cancelar sempre visível

### Mapas / Rastreamento
- Mapa ocupa pelo menos 60% da tela
- Painel lateral com lista de técnicos/OS
- Filtro por status visível sem scrollar

---

## Hierarquia visual

1. **Alerta crítico** → vermelho, topo da tela, não pode ser ignorado
2. **Ação primária** → teal, botão maior, visível sem scroll
3. **Status de OS** → badge colorido, sempre à esquerda do nome
4. **Dados secundários** → texto muted, menor destaque

---

## Mobile (app do técnico)

- Bottom navigation com no máximo 4 itens
- Botão de ação principal sempre fixo no rodapé
- Fotos e assinatura com câmera nativa
- Funcionamento offline obrigatório para visualização de OS
