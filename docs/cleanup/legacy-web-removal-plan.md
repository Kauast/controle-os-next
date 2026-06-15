# Plano de Remoção do Código Web Legado

Data: 2026-06-15  
Branch: feat/redesign-tecnico-mobile  
Responsável: legacy-modernizer

---

## Inventário Resumido

| Categoria | Quantidade | Arquivos |
|-----------|-----------|---------|
| MOBILE (preservar) | 5 | tecnico-mobile/layout, tecnico-mobile/login, tecnico-mobile/page, tecnico/page* |
| COMPARTILHADO (preservar) | 49 | Todos os hooks/libs/stores/components que o mobile importa |
| WEB-LEGADO REMOVÍVEL | 9 | Ver seção abaixo |
| AMBÍGUO / Decisão humana | 6 | Ver seção abaixo |

*`src/app/tecnico/page.tsx` é versão WEB do técnico mas importa `useCurrentUser`, `useServiceOrders`, `useProducts`, `useMaterialRequests` — todos usados pelo mobile via caminho diferente. A ROTA pode ser removida mas os hooks que ela usa são compartilhados.

---

## Grafo de dependências do app MOBILE

### Imports diretos de src/app/tecnico-mobile/page.tsx
- `@/components/ui/button` → PRESERVAR (ui/)
- `@/components/ui/badge` → PRESERVAR (ui/)
- `@/components/ui/card` → PRESERVAR (ui/)
- `@/components/ui/input` → PRESERVAR (ui/)
- `@/components/ui/label` → PRESERVAR (ui/)
- `@/components/ui/empty-state` → PRESERVAR (ui/)
- `@/components/ui/stat-card` → PRESERVAR (ui/)
- `@/components/tecnico/signature-pad` → PRESERVAR (tecnico/)
- `@/lib/utils` → PRESERVAR
- `@/lib/mobile/camera` → PRESERVAR
- `@/lib/mobile/geo` → PRESERVAR
- `@/lib/mobile/network` → PRESERVAR
- `@/lib/mobile/offline-queue` → PRESERVAR
- `@/lib/api/mobile-client` → PRESERVAR
- `@/hooks/useServiceOrdersMobile` → PRESERVAR

### Imports diretos de src/app/tecnico-mobile/login/page.tsx
- `@/components/layout/LionShield` → PRESERVAR (usado pelo mobile)
- `@/components/ui/button` → PRESERVAR
- `@/components/ui/input` → PRESERVAR
- `@/lib/api/mobile-client` → PRESERVAR

### Imports transitivos (preservar)
- `@/lib/react-query/queryClient` (via useServiceOrdersMobile)
- `@/store/use-auth-store` (via providers.tsx → layout.tsx → todos as rotas)
- `@/store/use-app-store` (via providers.tsx)
- `@/lib/auth` (via use-auth-store → providers)
- `@/lib/types` (via use-app-store, adapters, vários hooks)
- `@/lib/utils` (via use-app-store via nowLabel)
- `@/lib/constants` (via use-visible-orders — mas este é web-legado; constants pode ser preservado se outros usarem)
- `@/lib/mobile/storage` (via mobile-client)
- `@/lib/api/backend-config` (via api/auth routes)
- `@/lib/api/csrf-validate` (via api/backend route)

---

## Arquivos COMPROVADAMENTE REMOVÍVEIS

### Prova de não-uso pelo mobile:
Nenhum destes arquivos é importado (direta ou transitivamente) por:
- `src/app/tecnico-mobile/**`
- `src/hooks/useServiceOrdersMobile.ts`
- `src/lib/mobile/**`
- `src/lib/api/mobile-client.ts`

| # | Arquivo | Justificativa | Prova |
|---|---------|--------------|-------|
| 1 | `src/app/tecnico/page.tsx` | Versão WEB do técnico. Usa session cookie + apiClient web. O mobile usa tecnico-mobile/. `git grep` não encontra este arquivo importado por ninguém. | Nenhum arquivo importa esta página. |
| 2 | `src/app/tecnico/login/page.tsx` | Login WEB para o técnico via cookie. O mobile usa tecnico-mobile/login/. `git grep` não encontra importador. | Nenhum arquivo importa esta página. |
| 3 | `src/app/mobile/page.tsx` | Versão PWA de demonstração (usa useAppStore com dados mock). Importa `lib/access`, `store/use-app-store`, `hooks/use-hydrated` — todos exclusivos do dashboard web. O Capacitor não aponta para /mobile. | Nenhum arquivo importa esta página. |
| 4 | `src/app/mobile/layout.tsx` | Layout da rota /mobile, descartada junto com page.tsx. | Nenhum arquivo importa este layout. |
| 5 | `src/app/login/page.tsx` | Login web administrativo. Usa apiClient web, cookies httpOnly. O mobile tem seu próprio login em tecnico-mobile/login. | Nenhum arquivo importa esta página. |
| 6 | `src/app/login/layout.tsx` | Layout da rota /login, descartado junto com page.tsx. | Nenhum arquivo importa. |
| 7 | `src/app/reset-password/page.tsx` | Reset de senha via link por email — exclusivo do fluxo web. O mobile não tem recuperação de senha. | Nenhum arquivo importa esta página. |
| 8 | `src/lib/api.ts` | Arquivo marcado como @deprecated no próprio código. Duplicata de lib/api/reports.ts. Nenhum importador em src/. | `git grep "lib/api['\"]" -- src/` → sem resultados. |
| 9 | `src/lib/seed.ts` | Arquivo marcado como @deprecated no próprio código. Exporta apenas arrays vazios. Nenhum importador em src/. | `git grep "lib/seed" -- src/` → sem resultados. |
| 10 | `src/lib/api/config.ts` | Exporta `isCapacitorApp()` e `getMobileApiBase()` — parece mobile, mas NÃO é importado por ninguém (nem pelo mobile-client). Arquivo órfão. | `git grep "lib/api/config" -- src/` → sem resultados. |

---

## Arquivos MANTIDOS POR AMBIGUIDADE (decisão humana)

Estes arquivos SÃO usados exclusivamente pelo dashboard web legado, mas têm implicações arquiteturais que justificam revisão humana antes da remoção.

| Arquivo | Motivo para manter / decidir |
|---------|------------------------------|
| `src/app/page.tsx` | Dashboard web principal. Usa Sidebar, Topbar, todos os painéis. Se o site web for completamente descontinuado aqui, pode ser removido junto com todos os componentes abaixo. Mas é o "root route" — remoção sem substituto causa 404 na raiz. |
| `src/app/providers.tsx` | Importado por `src/app/layout.tsx` que envolve TODAS as rotas, incluindo tecnico-mobile. Preservar obrigatoriamente. |
| `src/app/layout.tsx` | Root layout — envolve tecnico-mobile também. Preservar obrigatoriamente. |
| `src/components/layout/sidebar.tsx` | Usado apenas por app/page.tsx (web). Se page.tsx for removido, pode ser removido em cascata. Aguarda decisão sobre page.tsx. |
| `src/components/layout/topbar.tsx` | Mesmo caso de sidebar.tsx. |
| `src/components/layout/mobile-sidebar.tsx` | Mesmo caso de sidebar.tsx. Nome confuso (é a sidebar responsiva do DASHBOARD WEB, não do app mobile). |
| `src/components/dashboard/**` (5 arquivos) | Usados apenas por app/page.tsx. Cascata de page.tsx. |
| `src/components/dialogs/**` (3 arquivos) | Usados apenas por app/page.tsx. Cascata de page.tsx. |
| `src/components/clients/**` (2 arquivos) | Usados apenas por app/page.tsx. |
| `src/components/finance/finance-panel.tsx` | Usado apenas por app/page.tsx. |
| `src/components/os/os-kanban.tsx` | Usado apenas por app/page.tsx. |
| `src/components/reports/reports-panel.tsx` | Usado apenas por app/page.tsx. |
| `src/components/stock/stock-panel.tsx` | Usado apenas por app/page.tsx. |
| `src/components/teams/**` (2 arquivos) | Usados apenas por app/page.tsx. |
| `src/components/tracking/tracking-panel.tsx` | Usado apenas por app/page.tsx. |
| `src/components/stock/qr-code.tsx` | Usado apenas por stock-panel.tsx. |
| `src/hooks/use-hydrated.ts` | Usado por app/page.tsx e app/mobile/page.tsx (removível). Mas é genérico e inócuo. |
| `src/hooks/use-visible-orders.ts` | Usado por dashboard web. |
| `src/hooks/useServiceOrders.ts` | Usado por app/tecnico/page.tsx (removível) E por dispatch-board, os-kanban, order-queue, use-visible-orders. Cascata da remoção web. |
| `src/hooks/useCurrentUser.ts` | Usado apenas por app/tecnico/page.tsx (removível). |
| `src/hooks/useProducts.ts` | Usado por app/tecnico/page.tsx + stock-panel.tsx. |
| `src/hooks/useMaterialRequests.ts` | Usado por app/tecnico/page.tsx + new-os-dialog.tsx. |
| `src/hooks/useClients.ts` | Usado por clients-panel. |
| `src/hooks/useChips.ts` | Usado por clients-panel. |
| `src/hooks/useTeamLocations.ts` | Usado por tracking-panel. |
| `src/hooks/useTechnicians.ts` | Usado por dispatch-board, new-os-dialog, teams-panel. |
| `src/hooks/useUsers.ts` | Usado por profiles-panel. |
| `src/hooks/queries.ts` | Usado por finance-panel, reports-panel. |
| `src/hooks/useAutoSave.ts` | Usado por clients-panel. |
| `src/hooks/useDebounce.ts` | Usado por clients-panel. |
| `src/hooks/useLocalStorage.ts` | Genérico. Usado por schedule-dialog. |
| `src/lib/access.ts` | Usado por app/page.tsx, app/mobile/page.tsx (removível), use-visible-orders. Se page.tsx for removido, pode ser removido. |
| `src/lib/adapters.ts` | Usado por use-visible-orders. |
| `src/lib/orders.ts` | Usado por agenda-panel, dispatch-board, order-queue. |
| `src/lib/csv.ts` | Usado por clients-panel. |
| `src/lib/api/reports.ts` | Usado por queries.ts. |
| `src/lib/constants.ts` | Usado por use-visible-orders. |
| `src/store/use-ui-store.ts` | Usado por app/page.tsx e todos os componentes web de layout/dialog. |
| `src/store/use-app-store.ts` | Usado por providers.tsx (raiz), app/page.tsx, app/mobile/page.tsx, use-visible-orders. providers.tsx é root e não pode ser removido. |
| `src/components/ui/sign-in.tsx` | Usado apenas por app/login/page.tsx (removível neste PR). |
| `src/components/ui/dialog.tsx` | Usado por dialogs/ web. |
| `src/components/ui/table.tsx` | Usado por painéis web. |
| `src/components/ui/tabs.tsx` | Usado por painéis web. |
| `src/components/ui/select.tsx` | Usado por app/tecnico/page.tsx (removível) + painéis web. |
| `src/components/ui/delete-button.tsx` | Usado por painéis web. |
| `src/components/ui/ErrorBoundary.tsx` | Não encontrado em importações — verificar manualmente. |

---

## Decisão de Remoção em Cascata (sugestão futura)

Se o usuário confirmar que o dashboard web (`src/app/page.tsx`) deve ser removido, toda a cascata de componentes web pode ser removida com segurança (exceto o que `providers.tsx` e `layout.tsx` precisam). Isso totalizaria ~35 arquivos adicionais.

---

## Resultado da Execução (2026-06-15)

### Arquivos removidos (10 arquivos + 5 diretórios vazios)
1. `src/app/tecnico/page.tsx` — versão web do técnico
2. `src/app/tecnico/login/page.tsx` — login web do técnico
3. `src/app/mobile/page.tsx` — PWA de demonstração
4. `src/app/mobile/layout.tsx` — layout da rota /mobile
5. `src/app/login/page.tsx` — login administrativo web
6. `src/app/login/layout.tsx` — layout da rota /login
7. `src/app/reset-password/page.tsx` — reset de senha web
8. `src/lib/api.ts` — duplicata deprecated de lib/api/reports.ts
9. `src/lib/seed.ts` — seed deprecated com arrays vazios
10. `src/lib/api/config.ts` — arquivo órfão sem importadores

Diretórios vazios removidos: `src/app/tecnico/login/`, `src/app/tecnico/`, `src/app/mobile/`, `src/app/login/`, `src/app/reset-password/`

### Validação
- `npx tsc --noEmit` → 0 erros em src/ (erros em services/* são pré-existentes sem node_modules)
- `npx eslint src/ --max-warnings 0` → "ESLint: No issues found"
- Todas as mudanças M do redesign mobile preservadas intactas

### Nota sobre middleware.ts
O arquivo `middleware.ts` ainda referencia `/tecnico/login` como rota pública. Este arquivo está marcado como M (modificado pelo redesign) e não foi alterado por esta limpeza. A referência a `/tecnico/login` agora é uma rota inexistente — não causa erro de compilação, mas pode ser limpa pelo responsável pelo redesign quando for conveniente.
