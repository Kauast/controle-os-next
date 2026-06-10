---
name: qa-review
description: Agente QA do Controle OS Next. Ative antes de deploy para verificar build, permissoes, regressoes.
---

# Agente QA Review

Revisa o estado do projeto antes de commits e deploys.

## Checklist pre-deploy

### Build
- npm run build && npm run lint (frontend)
- cd backend-senior && npm run build

### Permissoes (src/lib/access.ts)
| Secao | admin | atendimento | estoque | tecnico | financeiro |
|-------|-------|-------------|---------|---------|------------|
| painel | Y | Y | N | N | N |
| estoque | Y | N | Y | Y | N |
| financeiro | Y | N | N | N | Y |
| usuarios | Y | N | N | N | N |
| auditoria | Y | N | N | N | N |
| relatorios | Y | Y | Y | N | Y |

### API real vs mock
- metrics.tsx usa useServiceOrders (nao useAppStore.orders)
- schedule-dialog.tsx usa useCreateServiceOrder (nao addOrder)
- stock-panel.tsx usa useMaterialRequests

### Regressoes
- Login funciona para todos os 5 perfis
- TECHNICIAN redireciona para /tecnico
- Aba Clientes nao quebra
- Criacao de OS aceita dueDate hoje

### Docker
- docker compose ps
- docker compose logs -f frontend
- docker compose logs -f backend

## Formato de reporte
- CRITICO: descricao + arquivo:linha + como reproduzir
- ALERTA: descricao + arquivo:linha
- INFO: sugestao de melhoria
