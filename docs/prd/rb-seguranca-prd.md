# PRD — RB Segurança

## Produto

**RB Segurança** — SaaS de gestão de operações de campo para empresas de segurança eletrônica e manutenção.

---

## Usuários

| Perfil | Responsabilidade |
|---|---|
| **Administrador** | Configuração do sistema, relatórios gerenciais, gestão de usuários |
| **Supervisor** | Aprovação de OSs, acompanhamento de equipes, visão geral das operações |
| **Despachante** | Abertura e despacho de OSs, agenda de técnicos, contato com clientes |
| **Técnico** | Execução de OSs em campo, registro de materiais, coleta de assinatura |

---

## Objetivo

Gerenciar operações de campo de ponta a ponta: desde a abertura de uma OS até o fechamento financeiro, rastreamento de técnicos e controle de estoque — substituindo planilhas e processos manuais por um sistema integrado e em tempo real.

---

## KPIs Principais

| Métrica | Descrição |
|---|---|
| **Tempo médio de atendimento** | Do momento de abertura da OS até a conclusão pelo técnico |
| **Produtividade por equipe** | Número de OSs concluídas por técnico/período |
| **Taxa de retrabalho** | OSs que precisaram de retorno após conclusão |
| **Giro de estoque** | Velocidade de consumo e reposição de materiais |

---

## Fluxo Principal

```
Cliente
  ↓
Abertura de OS (Despachante)
  ↓
Despacho para Técnico (Agenda)
  ↓
Execução em Campo (App Técnico)
  ↓
Registro de Materiais (Estoque)
  ↓
Coleta de Assinatura + Fechamento
  ↓
Faturamento (Financeiro)
  ↓
Relatórios e KPIs
```

---

## Módulos

### 1. Ordens de Serviço (OS)
- Abertura manual ou via cliente (portal/WhatsApp)
- Tipos: preventiva, corretiva, instalação, visita técnica
- Status: aberta → despachada → em andamento → concluída → faturada
- Prioridades: baixa, média, alta, crítica
- SLA configurável por tipo e cliente

### 2. Agenda / Despacho
- Dispatch board estilo ServiceTitan
- Visão de calendário semanal por técnico
- Drag-and-drop para reatribuição
- Mapa com posição atual dos técnicos
- Notificação automática ao técnico designado

### 3. Clientes
- Cadastro completo com histórico de OSs
- Múltiplos endereços e equipamentos por cliente
- Contatos (WhatsApp integrado)
- Contratos e planos de manutenção

### 4. Estoque
- Controle por almoxarifado e veículo técnico
- Entrada/saída por QR Code
- Alertas de estoque mínimo
- Vinculação de materiais à OS
- Histórico de movimentação

### 5. Financeiro
- Geração de cobrança a partir de OS concluída
- Controle de recebimentos
- Comissão por técnico
- Relatório de rentabilidade por cliente/serviço

### 6. Rastreamento
- Mapa em tempo real dos técnicos
- Histórico de rota por dia
- Check-in/check-out automático por geofence

### 7. Relatórios
- KPIs operacionais (tempo médio, produtividade)
- Relatório financeiro (por período, cliente, técnico)
- Estoque (posição atual, movimentações, custo)
- Exportação em PDF e Excel

### 8. App Técnico (Mobile)
- Visualização de OSs do dia
- Aceitar/recusar OS
- Checklist de execução
- Registro de materiais usados
- Fotos antes/depois
- Assinatura digital do cliente
- Funcionamento offline

---

## Restrições técnicas

- Resposta da API < 300ms para operações críticas
- App mobile com suporte a iOS 14+ e Android 10+
- Dados do cliente nunca expostos no app técnico além do necessário
- Backup automático diário do banco de dados
- Logs de auditoria para todas as ações de admin

---

## Não incluído (v1)

- Integração com ERP externo
- Portal self-service do cliente
- BI avançado (previsto para v2)
