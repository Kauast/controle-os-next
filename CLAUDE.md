# CLAUDE.md

Guia obrigatório para agentes de IA trabalhando neste repositório.

## Projeto

`controle-os-next` é um sistema de controle de Ordens de Serviço com painel web, experiência mobile/PWA e build Android via Capacitor.

Prioridades do projeto:

1. Estabilidade em produção.
2. Segurança e isolamento por empresa/usuário.
3. Robustez mobile e operação offline.
4. Consistência de estoque e dados críticos.
5. Código simples, tipado, testável e escalável.

## Stack principal

* Next.js 15
* React 19
* TypeScript
* Tailwind CSS
* Capacitor Android
* TanStack Query
* IndexedDB/offline storage
* Vitest
* ESLint

## Comandos

Use sempre os comandos do projeto antes de finalizar alterações relevantes:

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

Para mobile:

```bash
npm run build:mobile
npm run cap:sync
npm run apk:debug
npm run apk:release
```

## Regras de ouro

* Nunca quebre fluxo mobile para corrigir apenas desktop.
* Nunca acesse ou altere dados sem respeitar `companyId`, permissões e escopo do usuário.
* Nunca mova regra de negócio sensível para componentes React.
* Nunca faça mutações críticas sem validação no servidor.
* Nunca confie apenas no estado local para estoque, autenticação, upload ou conclusão de OS.
* Nunca silencie erro crítico; trate, logue e retorne feedback claro.
* Nunca introduza dependência nova sem necessidade real.

## Arquitetura esperada

Organize responsabilidades assim:

```txt
src/
  app/                  Rotas Next.js, páginas e API routes
  components/           Componentes visuais reutilizáveis
  hooks/                Hooks de dados e estado de tela
  lib/                  Regras compartilhadas, validações, auth, storage, helpers
  store/                Estado client-side quando necessário
  tests/                Testes unitários/integrados
scripts/                Scripts de build e automação
```

Preferências:

* API routes devem ser finas.
* Regras críticas devem ficar em `lib/` ou serviços dedicados.
* Componentes devem receber dados prontos e emitir ações claras.
* Hooks devem encapsular TanStack Query, cache, invalidation e estados assíncronos.
* Código mobile/offline deve ser isolado para não contaminar fluxos web.

## Segurança

Ao alterar autenticação, uploads, OS, estoque, técnicos, clientes ou empresas:

* Validar usuário autenticado no servidor.
* Validar autorização por role/permissão.
* Filtrar sempre por `companyId` quando existir multiempresa.
* Não retornar dados sensíveis desnecessários.
* Não aceitar IDs do client sem checar pertencimento.
* Sanitizar entradas vindas do usuário.
* Evitar logs com tokens, senhas, cookies, documentos, localização precisa ou anexos sensíveis.

Checklist mínimo para API routes:

```ts
// 1. autenticar usuário
// 2. validar payload
// 3. checar permissão
// 4. aplicar escopo companyId
// 5. executar operação
// 6. retornar resposta tipada e segura
```

## Estoque e concorrência

Estoque é área crítica.

Ao mexer em estoque:

* Use transações para entradas, saídas, reservas e ajustes.
* Garanta isolamento por `companyId`.
* Evite race conditions.
* Não calcule saldo final apenas no frontend.
* Registre movimentações de forma auditável.
* Valide quantidade positiva.
* Bloqueie saída maior que saldo disponível.
* Teste cenários simultâneos quando houver lock, reserva ou baixa.

Regra: estoque deve ser consistente mesmo com duas requisições acontecendo ao mesmo tempo.

## Ordens de Serviço

Fluxo de OS deve preservar histórico e rastreabilidade.

Ao alterar OS:

* Não sobrescrever dados importantes sem necessidade.
* Registrar status de forma previsível.
* Validar transições de status.
* Evitar que OS concluída volte para estado aberto sem regra explícita.
* Validar técnico responsável antes de permitir alterações.
* Não depender somente do client para marcar check-in, fotos, assinatura ou conclusão.

Estados comuns devem ser tratados de forma clara:

* Aberta
* Em andamento
* Aguardando peças
* Concluída
* Cancelada

## Mobile, PWA e offline

Mobile é prioridade do projeto.

Ao alterar fluxo mobile:

* Preservar funcionamento com conexão ruim.
* Não quebrar IndexedDB/cache offline.
* Planejar retry de operações pendentes.
* Mostrar feedback visual para estados pendente, sincronizando, sincronizado e erro.
* Evitar perda de fotos, assinatura, check-in ou dados de OS.
* Testar reload, fechamento do app e perda de conexão.
* Evitar APIs indisponíveis em WebView/Capacitor sem fallback.

Operações offline devem ser idempotentes sempre que possível.

Use identificadores locais temporários quando necessário, mas reconcilie com IDs reais do servidor após sincronização.

## Uploads, fotos e assinatura

Uploads são sensíveis e instáveis em mobile.

Ao mexer nisso:

* Validar tipo e tamanho do arquivo.
* Tratar falhas de rede.
* Evitar duplicidade no retry.
* Não perder imagem local antes da confirmação do servidor.
* Usar preview local quando fizer sentido.
* Separar estado local de estado confirmado.
* Não armazenar dados grandes desnecessariamente em memória.

## TanStack Query

Padrão recomendado:

* Queries com keys estáveis e específicas.
* Mutations com invalidação explícita.
* Evitar refetch global desnecessário.
* Tratar loading, empty, error e success.
* Em mobile/offline, preferir persistência e retry controlado.

Exemplo de naming:

```ts
["service-orders", companyId, filters]
["products", companyId]
["current-user"]
["material-requests", serviceOrderId]
```

## TypeScript

* Evite `any`.
* Prefira tipos explícitos em boundaries: API, hooks, services e payloads.
* Use narrowing em vez de cast forçado.
* Não ignore erro de TypeScript sem justificativa.
* Tipos de domínio devem ser reutilizados, não duplicados em cada componente.

## UI e UX

* Preserve responsividade mobile.
* Mantenha telas críticas simples e rápidas.
* Não esconda erro do usuário.
* Use estados vazios claros.
* Botões de ação crítica devem ter loading/disabled.
* Evite múltiplos submits.
* Confirme ações destrutivas.

## Performance

* Evite re-render desnecessário em listas grandes.
* Paginar ou limitar listas de OS, produtos e movimentações.
* Evitar carregar imagens grandes sem necessidade.
* Não bloquear UI durante sincronização.
* Preferir operações incrementais a refetch completo quando seguro.

## Testes

Adicionar ou atualizar testes quando mexer em:

* Estoque
* Auth
* Permissões
* Offline queue
* Upload
* Status de OS
* Validações de API
* Sincronização mobile

Comandos:

```bash
npm run test
npm run type-check
npm run lint
```

Teste obrigatório para bug corrigido: crie um teste que falharia antes da correção.

## Padrão de commits

Use commits claros:

```txt
feat(mobile): add offline retry for service order updates
fix(stock): prevent cross-company stock movement
fix(auth): validate technician session before mobile actions
test(offline): cover queued upload retry
refactor(os): move status transition rules to service layer
```

## Antes de finalizar qualquer tarefa

Verifique:

* Código compila.
* Lint passa.
* Type-check passa.
* Testes passam ou motivo da falha foi documentado.
* Fluxo mobile não foi quebrado.
* Dados estão filtrados por empresa/usuário.
* Erros são tratados.
* Nenhum segredo foi exposto.
* Nenhum comportamento crítico ficou só no frontend.

## Como responder ao usuário

Ao concluir alterações, informe:

1. O que mudou.
2. Arquivos principais alterados.
3. Testes/comandos executados.
4. Riscos ou pontos que precisam revisão humana.

Se não executou algum comando, diga claramente.
