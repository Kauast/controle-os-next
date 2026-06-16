# Git Workflow Padronizado - Controle OS

Guia completo de branching, commits, PRs e deploy automatizado.

## Índice

1. [Estratégia de Branches](#estratégia-de-branches)
2. [Convenção de Commits](#convenção-de-commits)
3. [Fluxo de Trabalho](#fluxo-de-trabalho)
4. [Pull Requests](#pull-requests)
5. [CI/CD e Deploy](#cicd-e-deploy)
6. [Proteção de Branches](#proteção-de-branches)
7. [Troubleshooting](#troubleshooting)

---

## Estratégia de Branches

Utilizamos **Git Flow** adaptado para CI/CD moderno. Cada branch tem um propósito específico:

### 1. Branch `main` (Produção)

- **Propósito**: Código em produção, sempre estável
- **Proteção**: ✅ Requer 1 review, testes passando
- **Origem**: Apenas merges de `release/` ou hotfixes
- **Deploy**: Automático via GitHub Actions → VPS

```bash
# Ver código em produção
git log --oneline main | head -10
```

### 2. Branch `develop` (Desenvolvimento)

- **Propósito**: Branch de integração contínua
- **Proteção**: ✅ Requer review, testes passando
- **Origem**: Features finalizadas (PR de `feature/*`)
- **Deploy**: Automático → Ambiente de staging (opcional)

```bash
# Sempre sincronizar antes de criar feature
git checkout develop
git pull origin develop
```

### 3. Branches de Feature (`feature/*`)

- **Convenção**: `feature/nome-descritivo` ou `feature/TICKET-123-descrição`
- **Origem**: Sempre de `develop`
- **Destino**: PR para `develop`
- **Ciclo de vida**: Deletado após merge

```bash
# Criar feature
git checkout develop
git pull origin develop
git checkout -b feature/login-oauth2

# Após conclusão, abrir PR
```

### 4. Branches de Bugfix (`bugfix/*`)

- **Convenção**: `bugfix/TICKET-456-descrição` ou `bugfix/descricao-curta`
- **Origem**: `develop`
- **Destino**: PR para `develop`
- **Para bugs em produção**: Use `hotfix/*` em vez disso

```bash
git checkout develop
git pull origin develop
git checkout -b bugfix/corrige-validacao-email
```

### 5. Branches de Hotfix (`hotfix/*`)

- **Convenção**: `hotfix/TICKET-789-descrição`
- **Origem**: `main` (bug em produção)
- **Destino**: PR para `main` E `develop` (2 PRs)
- **Deploy**: Direto para produção via GitHub Actions

```bash
# BUG CRÍTICO EM PRODUÇÃO
git checkout main
git pull origin main
git checkout -b hotfix/corrige-crash-login

# Após fix:
# 1. Abrir PR para main
# 2. Após merge: abrir PR da mesma branch para develop
```

### 6. Branches de Release (`release/*`)

- **Convenção**: `release/v1.2.0` ou `release/1.2.0`
- **Origem**: `develop`
- **Destino**: 
  - PR para `main` (com tag de release)
  - Merge de volta em `develop`
- **Propósito**: Preparar release (bump version, notas, testes finais)

```bash
# Criar release
git checkout develop
git pull origin develop
git checkout -b release/v1.3.0

# Editar versão, CHANGELOG, etc
git commit -am "chore: bump version to 1.3.0"

# Abrir PR para main
# Após merge: sincronizar develop
```

---

## Convenção de Commits

Utilizamos **Conventional Commits** com prefixos:

### Formato

```
<tipo>(<escopo>): <descrição breve>

<corpo detalhado (opcional)>

<rodapé com referências (opcional)>
```

### Tipos válidos

| Tipo | Uso | Exemplo |
|------|-----|---------|
| `feat` | Nova funcionalidade | `feat(auth): implementa OAuth2 Google` |
| `fix` | Correção de bug | `fix(backend): corrige race condition no cache` |
| `perf` | Otimização de performance | `perf(frontend): lazy-load componentes pesados` |
| `refactor` | Mudança de código sem nova feature | `refactor(api): simplifica validação de email` |
| `docs` | Documentação | `docs: atualiza setup.md com variáveis` |
| `test` | Testes | `test(backend): adiciona testes de validação` |
| `chore` | Build, deps, config | `chore: atualiza Next.js para 15.6` |
| `ci` | CI/CD | `ci: adiciona workflow de deploy automático` |
| `style` | Formatação (não lógica) | `style: formata código com prettier` |

### Escopos comuns

- `auth` — Autenticação, JWT, sessions
- `backend` — API, banco de dados
- `frontend` — UI, componentes React
- `mobile` — App Capacitor/Android
- `infra` — Docker, nginx, deploy
- `db` — Migrations, schema Prisma

### Exemplos válidos

```bash
# Boa feature
git commit -m "feat(estoque): implementa leitura de QR Code com câmera"

# Boa correção
git commit -m "fix(backend): corrige erro 500 ao criar ordem sem cliente

Quando cliente_id era null, a query falhava sem mensagem de erro.
Adicionada validação com mensagem clara antes da inserção."

# Boa otimização
git commit -m "perf(frontend): memoize componentes de lista de OS

Reduz re-renders desnecessários durante filtros.
Benchmark: 800ms → 150ms em lista de 1000 itens."

# Release
git commit -m "chore: bump version 1.2.0 → 1.3.0"

# Revert
git commit -m "revert: rollback OAuth2 (causa logout infinito)

This reverts commit abc123def456."
```

---

## Fluxo de Trabalho

### Passo a Passo: Implementar uma Feature

#### 1. Prepare seu ambiente local

```bash
# Sincronizar branches
git fetch origin
git checkout develop
git pull origin develop

# Criar feature
git checkout -b feature/TICKET-123-novo-relatorio

# Confirmar que está na branch correta
git branch --show-current
# Output: feature/TICKET-123-novo-relatorio
```

#### 2. Desenvolva e faça commits atômicos

```bash
# Editar arquivos...

# Ver o que mudou
git status
git diff

# Adicionar mudanças
git add src/pages/relatorios.tsx
git add src/components/RelatorioCard.tsx

# Commit com mensagem descritiva
git commit -m "feat(relatorios): adiciona painel de relatórios por equipe

- CRUD de templates de relatório
- Exportação para PDF
- Filtros por período e equipe"

# Mais commits conforme necessário
git add backend-senior/src/routes/relatorios.ts
git commit -m "feat(backend): endpoint GET /api/relatorios/{id}/export"
```

#### 3. Sincronizar com develop antes de enviar

```bash
# Buscar últimas mudanças
git fetch origin

# Se há mudanças em develop, atualizar sua branch
if git diff develop..HEAD --name-only | grep -q .; then
  git rebase origin/develop
fi

# Se houver conflitos, resolvê-los manualmente
# git rebase --continue
```

#### 4. Fazer push para origem

```bash
# Primeira vez
git push -u origin feature/TICKET-123-novo-relatorio

# Próximos pushes
git push origin
```

#### 5. Abrir Pull Request

- Acesse: https://github.com/Kauast/controle-os-next/pulls
- Clique em "New Pull Request"
- De: sua branch de feature
- Para: `develop`
- Título: `feat: descrição clara da feature`
- Descrição: Use template (vide seção PR)

#### 6. Solicitar review e responder comentários

```bash
# Se solicitadas mudanças:
# 1. Editar código
# 2. Fazer novo commit
# 3. Push (o PR atualiza automaticamente)

git add .
git commit -m "review: ajusta validação conforme feedback"
git push origin
```

#### 7. Merge para develop

- Após aprovação e CI passar ✅
- Clicar "Squash and merge" (recomendado)
- Deletar branch remota (checkbox no GitHub)

```bash
# Localmente, limpar
git checkout develop
git pull origin develop
git branch -d feature/TICKET-123-novo-relatorio
```

---

## Pull Requests

### Template de PR

**Título**:
```
feat: descrição curta em imperative mood
```

**Descrição** (corpo do PR):

```markdown
## Descrição
Brief explanation of what this PR accomplishes.

## Tipo de Mudança
- [ ] Nova funcionalidade (non-breaking)
- [ ] Correção de bug
- [ ] Breaking change (requer review especial)
- [ ] Documentação

## Checklist
- [ ] Código testado localmente (`npm run dev` ou `npm test`)
- [ ] Sem lint errors (`npm run lint`)
- [ ] Build passa (`npm run build`)
- [ ] Commits com conventional commit format
- [ ] Dependências adicionadas se necessário
- [ ] Documentação/README atualizado

## Link para issue
Closes #123

## Screenshots (se UI)
Descrever visualmente o que mudou.
```

### Critérios de Revisão

1. **Código**: Segue convenções, sem duplicação, bem estruturado
2. **Testes**: Features incluem testes (backend com `npm test`)
3. **Performance**: Sem regressões obvias (checklist da perf)
4. **Segurança**: Sem secrets em commits, inputs validados
5. **Docs**: README/Arquitetura atualizados se necessário

### SLA de Review

- 🟢 **Hotfix**: < 1 hora
- 🟡 **Bugfix**: < 4 horas
- 🟢 **Feature simples**: < 24 horas
- 🟡 **Feature complexa**: 2-3 dias

---

## CI/CD e Deploy

### GitHub Actions Workflows

#### 1. Workflow `ci.yml` — Testa toda PR

```yaml
# Roda em:
# - Qualquer PR para main
# - Push em main ou develop

# Testa:
✅ Backend typecheck
✅ Backend testes (jest)
✅ Frontend typecheck
✅ Frontend build
✅ Docker build (backend + frontend)
✅ docker-compose config validation
✅ Nenhum .env sensível commitado
```

**Status no PR**: Verde = mergeável, Vermelho = falhou

#### 2. Workflow `deploy.yml` — Deploy automático

```yaml
# Roda APÓS ci.yml passar na main
# Conecta via SSH ao VPS e:

1. git pull origin main (--ff-only)
2. ./scripts/deploy.sh backend
3. ./scripts/deploy.sh frontend
4. docker compose restart nginx
```

**Tempo**: ~5-10 minutos total

### Como Forçar Re-run de CI

Se CI travou ou você quer retestatar sem commit:

```bash
# Re-run no GitHub (UI)
# 1. Ir para Actions
# 2. Selecionar workflow
# 3. Clicar "Re-run all jobs"

# OU via CLI (gh)
gh run rerun <run-id>
```

### Variáveis de Ambiente para CI

Definidas em: **Settings > Secrets and variables > Actions**

```
VPS_HOST            = seu-dominio.com
VPS_USER            = deploy_user
VPS_SSH_KEY         = private key (sem passphrase)
VPS_SSH_PORT        = 22 (ou outra)

NODE_ENV            = production (automático no build)
BACKEND_URL         = https://seu-dominio.com
JWT_SECRET          = chave aleatória 32+ chars
```

### Versioning e Releases

```bash
# Ao criar release/v1.3.0:
# 1. Atualizar package.json: "version": "1.3.0"
# 2. Atualizar CHANGELOG.md
# 3. Commit: chore: bump version to 1.3.0
# 4. Tag: git tag -a v1.3.0 -m "Release 1.3.0"
# 5. Merge release branch em main
# 6. GitHub cria release automático (opcional)

git checkout release/v1.3.0
git push origin --tags
```

---

## Proteção de Branches

### Regras para `main`

Habilitar em: **Settings > Branches > Branch protection rules**

```
Branch name pattern: main

Require status checks to pass before merging:
  ✅ Backend — typecheck, tests
  ✅ Frontend — typecheck, build
  ✅ Docker build + compose validation
  ✅ Verificar .env não commitado

Require code review:
  ✅ Minimum 1 approval
  ✅ Dismiss stale PR approvals
  ✅ Require CODEOWNERS review

Restrictions:
  ✅ Restrict who can push (somente git-bot ou admin)
  ✅ Allow force pushes: ❌ (nunca)
  ✅ Allow deletions: ❌ (nunca)
```

### Regras para `develop`

```
Branch name pattern: develop

Require status checks:
  ✅ Mesmo que main

Require code review:
  ✅ Minimum 1 approval

Restrictions:
  ✅ Allow force pushes: ❌
  ✅ Allow deletions: ❌
```

### Configurar CODEOWNERS

Arquivo: `.github/CODEOWNERS`

```
# Todos os arquivos
* @Kauast

# Backend requer review de backend
backend-senior/ @Kauast @outro-dev-backend

# Mobile requer mobile expert
android/ @Kauast

# Infra requer devops
nginx/ @Kauast
docker-compose.yml @Kauast
```

---

## Troubleshooting

### Problema: "Your branch is behind origin/develop"

```bash
# Sincronizar sua feature com develop
git fetch origin
git rebase origin/develop

# Se houver conflitos:
# 1. Resolver arquivos manualmente
# 2. git add .
# 3. git rebase --continue

# Depois fazer push (force é OK em feature branches)
git push origin --force-with-lease
```

### Problema: "Changes requested" no PR

```bash
# Não criar nova branch, apenas editar e fazer push
# O GitHub atualiza o PR automaticamente

# Editar, commitar, push
git add .
git commit -m "review: ajusta conforme feedback"
git push origin feature/seu-nome
```

### Problema: Merge conflict em CI

```bash
# Resolvidas localmente ANTES de fazer push

# Ver conflitos
git status

# Editar arquivos com <<<< >>>> >>>>
# Ou usar ferramenta
git mergetool

# Resolver e continuar
git add .
git rebase --continue
git push origin
```

### Problema: "You don't have permission to push"

```bash
# Verificar autenticação
git config user.email
git config user.name

# Se credencial expirou, remover e refazer
git credential-manager erase https://github.com

# Tentar novamente (pedirá GITHUB_TOKEN)
git push origin feature/seu-nome
```

### Problema: Deletou branch por acidente

```bash
# Localizar commit
git reflog
# Output: abc1234 feature/deletada
# ...

# Recriar branch
git checkout -b feature/deletada abc1234

# Fazer push
git push origin feature/deletada
```

### Problema: Precisa fazer reset de commits

```bash
# ⚠️ CUIDADO: Apenas em branches de feature, NUNCA em main/develop

# Desfazer últimos N commits (mantém mudanças)
git reset --soft HEAD~3

# Ou descartar completamente
git reset --hard origin/feature/seu-nome
```

### Problema: Hotfix urgente mas CI lento

```bash
# Não pule CI! Mas você pode:

# 1. Abrir PR com urgência marcada
# GitHub Actions roda paralelo, ~3-5 min total

# 2. Se absolutamente crítico:
# Contatar admin para merge bypass (raro!)
```

---

## Checklist para Onboarding

Para novos desenvolvedores:

- [ ] Clone repo: `git clone ...`
- [ ] Configure user: `git config user.name "Seu Nome"`
- [ ] Leia este documento
- [ ] Rode `npm install && npm run lint`
- [ ] Crie feature branch: `git checkout -b feature/teste-inicial`
- [ ] Faça commit trivial: `git commit -m "test: hello world"`
- [ ] Abra PR para `develop`
- [ ] Peça review a um dev senior
- [ ] Aprenda o fluxo na prática

---

## Referências Rápidas

```bash
# Criar feature
git checkout develop && git pull origin develop
git checkout -b feature/descricao

# Ver status de branches
git branch -a
git log --oneline -5

# Sincronizar com develop
git fetch origin
git rebase origin/develop

# Limpar branches locais deletadas no remote
git remote prune origin

# Ver commits que ainda não estão em main
git log main..HEAD --oneline

# Amend (corrigir último commit)
git add .
git commit --amend --no-edit
git push origin --force-with-lease

# Revert commit publicado
git revert abc1234
git push origin

# Cherry-pick um commit de outra branch
git cherry-pick abc1234
git push origin
```

---

**Última atualização**: 2025-06-13  
**Maintainer**: Tim do Projeto  
**Dúvidas?** Abrir issue ou questionar em código review.
