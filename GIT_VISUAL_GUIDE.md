# Git Workflow — Guia Visual

Diagramas ASCII para entender o fluxo de branches e commits.

---

## 1. Estrutura de Branches

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│          main (Produção — sempre estável)                  │
│            │                                                │
│            └─→ ✅ Deploy automático ao GitHub Actions      │
│                                                             │
│          develop (Integração Contínua)                      │
│     ↗─────────────────────┐                                │
│    /                       \                                │
│   /                         \                               │
│ feature/...  bugfix/...  hotfix/...  release/...           │
│ (seu trabalho aqui)                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Fluxo de Feature Completo

### Cenário: Implementar novo painel de KPI

```
PASSO 1: Preparar
═════════════════════════════════════════════════════

$ git checkout develop                    ← Ir para develop
$ git pull origin develop                 ← Sincronizar
$ git checkout -b feature/painel-kpi      ← Criar feature

Local:  feature/painel-kpi
Remote: (não existe ainda)


PASSO 2: Desenvolver
═════════════════════════════════════════════════════

$ git add src/components/KPIPanel.tsx
$ git commit -m "feat(dashboard): adiciona painel de KPI"

Commits na branch:
  ✓ feat(dashboard): adiciona painel de KPI

$ git add src/pages/dashboard.tsx
$ git commit -m "feat(dashboard): integra KPI no dashboard"

Commits na branch:
  ✓ feat(dashboard): adiciona painel de KPI
  ✓ feat(dashboard): integra KPI no dashboard


PASSO 3: Sincronizar
═════════════════════════════════════════════════════

Se alguém fez merge em develop:

$ git fetch origin
$ git rebase origin/develop

Antes:                          Depois:
  develop (3 commits)             develop (5 commits)
  │                               │
  ├─→ feature (2 commits)         └─→ feature (2 commits atrasados)
                                   │
                            (agora também tem commits de outro dev)


PASSO 4: Fazer Push
═════════════════════════════════════════════════════

$ git push -u origin feature/painel-kpi

Agora a branch existe no GitHub!

Local:  feature/painel-kpi (2 commits à frente de develop)
Remote: feature/painel-kpi (sincronizado)


PASSO 5: Abrir Pull Request
═════════════════════════════════════════════════════

No GitHub.com:
  ✓ New Pull Request
  ✓ De: feature/painel-kpi
  ✓ Para: develop
  ✓ Título: "feat: adiciona painel de KPI ao dashboard"
  ✓ Descrição: [template preenchido]

GitHub Actions roda automaticamente:
  ⏳ Lint
  ⏳ Backend tests
  ⏳ Frontend build
  ⏳ Docker build
  ⏳ Security check

Se tudo passar: ✅ All checks passed


PASSO 6: Code Review
═════════════════════════════════════════════════════

Dev senior revisa:
  🔍 Verificar segurança
  🔍 Verificar performance
  🔍 Verificar testes
  🔍 Verificar conventions

Se pedir mudanças:

$ git add src/pages/dashboard.tsx
$ git commit -m "review: ajusta responsive conforme feedback"
$ git push origin

(PR atualiza automaticamente)

Se aprovar: ✅ Approved


PASSO 7: Merge
═════════════════════════════════════════════════════

No GitHub PR:
  ✓ Clique "Squash and merge"
  ✓ Clique "Confirm merge"
  ✓ Checkbox "Delete branch"

Resultado:
  main ─────────────────────
                           ╲
                            └─→ (seu commit agora aqui)
  
  develop ────────────────────
                              ╲
                               └─→ (seu commit agora aqui)
  
  feature/painel-kpi (DELETADO)


PASSO 8: Cleanup Local
═════════════════════════════════════════════════════

$ git checkout develop
$ git pull origin develop
$ git branch -d feature/painel-kpi

Done! Pronto para próxima feature.
```

---

## 3. Hotfix (Bug Crítico em Produção)

```
SITUAÇÃO: Usuários reportam crash no login em produção

main  ────────────────────────────────────────
      ✗ BUG!                    (aqui está o bug)


AÇÃO RÁPIDA:
═════════════════════════════════════════════════════

$ git checkout main
$ git pull origin main
$ git checkout -b hotfix/corrige-crash-login

  hotfix/corrige-crash-login
  │
  ├─ Identificar bug
  ├─ git add ...
  ├─ git commit -m "fix(auth): corrige crash no login"
  └─ git push -u origin hotfix/corrige-crash-login

(Abrir PR para main)

PARALELO: Enquanto aguarda, sincronizar develop

$ git checkout develop
$ git pull origin develop
$ git cherry-pick <commit-do-hotfix>
  ou
(Após merge do hotfix em main, fazer outro PR do hotfix para develop)


RESULTADO:
═════════════════════════════════════════════════════

main
  ├─ (versão bugada)
  ├─ ✓ fix: corrige crash       ← Seu hotfix
  └─ 🚀 Deploy automático

develop
  ├─ (código antigo)
  ├─ ✓ fix: corrige crash       ← Cherry-pick do hotfix
  └─ (sincronizado com main)

Usuários: ✅ Bug resolvido!
```

---

## 4. Release (Preparar versão)

```
Versão atual: 1.2.0 (em develop)
Pronto para release: 1.3.0


PASSO 1: Criar release branch
═════════════════════════════════════════════════════

$ git checkout develop
$ git pull origin develop
$ git checkout -b release/v1.3.0

  develop ────────────────────────────
                                      ╲
                                       └─→ release/v1.3.0


PASSO 2: Preparar release
═════════════════════════════════════════════════════

1. Atualizar versão:
   package.json: "version": "1.3.0"

2. Atualizar CHANGELOG.md:
   ## [1.3.0] - 2025-06-13
   ### Added
   - Nova feature X
   - Nova feature Y
   ### Fixed
   - Bug Z

$ git add package.json CHANGELOG.md
$ git commit -m "chore: bump version 1.2.0 → 1.3.0"

3. Testar build:
   $ npm run build
   $ npm run lint
   $ npm test


PASSO 3: Abrir PRs
═════════════════════════════════════════════════════

PR #1: release/v1.3.0 → main

  Título: "release: v1.3.0"
  
  Após aprovação:
  ✓ Merge
  ✓ GitHub cria release automático
  ✓ Deploy automático para produção


PR #2: release/v1.3.0 → develop

  Sincronizar develop com mudanças de release
  (ex: CHANGELOG.md, version bump)
  
  Após aprovação:
  ✓ Merge
  
  Agora develop tem versão 1.3.0


RESULTADO:
═════════════════════════════════════════════════════

main   ────────────────────── v1.3.0 ────────
       🔖 Tag: v1.3.0
       🚀 Deploy automático

develop ───────────────────────────── v1.3.0
        (sincronizado)
```

---

## 5. Estrutura de Commits em uma Feature

```
Código quebrado em develop (antes da feature):

  function calcularPreço(item) {
    return item.preco * 1.1;  // Hardcoded 10%
  }

YOUR COMMITS (feature/desconto-dinamico):

  Commit 1: feat(pricing): adiciona campo de desconto
    ├─ schema.prisma: +desconto_percentual
    └─ API GET retorna desconto

  Commit 2: feat(backend): endpoint para atualizar desconto
    ├─ POST /api/desconto/{id}
    └─ Validação de range 0-100%

  Commit 3: feat(frontend): UI para editar desconto
    ├─ Componente DescontoForm
    └─ Integração com API

  Commit 4: test(backend): testes de desconto
    ├─ Validação de range
    ├─ Cálculo de preço com desconto
    └─ Edge cases (desconto=0, desconto=100)

  Commit 5: refactor(pricing): extrai lógica de cálculo
    ├─ Nova função: calcularPreçoComDesconto()
    └─ Remoção de hardcoding

Após merge em develop (squash):

  develop: merge commit "feat(pricing): implementa desconto dinâmico"
           (contém todos os 5 commits internamente, mas history fica limpo)


HISTÓRIA LIMPA:

  main/develop/feature:
    ...
    └─ abc1234 feat(pricing): implementa desconto dinâmico
       └─ def5678 fix(auth): corrige token refresh
       └─ ghi9012 docs: atualiza README

  (Sem poluição de commits de test/refactor de implementação)
```

---

## 6. Estados de uma PR

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Estado 1: Aberta & Rodando CI                             │
│  ═════════════════════════════════════════════════════════ │
│                                                             │
│  ⏳ Lint                                                     │
│  ⏳ Backend tests                                            │
│  ⏳ Frontend build                                           │
│  ⏳ Docker build                                             │
│  ⏳ Security check                                           │
│  ⏳ Commits validation                                       │
│                                                             │
│  👤 Reviewers: awaiting review                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘

           ↓ (CI passa)

┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Estado 2: CI OK, Aguardando Review                        │
│  ═════════════════════════════════════════════════════════ │
│                                                             │
│  ✅ All checks passed                                      │
│  ⏳ 🔍 Waiting for reviews                                 │
│  ⏳ 📝 Draft review...                                     │
│                                                             │
│  👤 Reviewer: reviewing code                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘

           ↓ (Reviewer aprova)

┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Estado 3: CI OK, Review Aprovada, Pronto para Merge      │
│  ═════════════════════════════════════════════════════════ │
│                                                             │
│  ✅ All checks passed                                      │
│  ✅ 1 approval                                             │
│  ✅ Branch up to date with main                           │
│                                                             │
│  🟢 Ready to merge                                         │
│  👤 Author: can now merge                                  │
│                                                             │
│  Opções:
│    • Squash and merge (recomendado)
│    • Create a merge commit
│    • Rebase and merge
│                                                             │
└─────────────────────────────────────────────────────────────┘

           ↓ (Clica merge)

┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Estado 4: Merged & Deletado                               │
│  ═════════════════════════════════════════════════════════ │
│                                                             │
│  ✅ Pull request merged by username                        │
│  ✅ Branch deleted: feature/seu-nome                       │
│                                                             │
│  Código agora em develop (ou main)                         │
│  Sua feature é histórico!                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Resolvendo Conflicts

```
Situação: Outro dev mergeou código em develop enquanto você estava
          desenvolvendo feature/seu-nome

develop:           feature/seu-nome:
  ├─ auth.tsx        ├─ auth.tsx (você modificou)
  ├─ (novo arquivo)  └─ dashboard.tsx

Git tenta fazer rebase e encontra conflito em auth.tsx

┌────────────────────────────────────────┐
│ CONFLICT no arquivo auth.tsx:          │
│                                        │
│ <<<<<<< HEAD                           │
│ // Código de outro dev                 │
│ function newLoginFlow() { ... }        │
│ =======                                │
│ // Seu código                          │
│ function newLoginFlow() { ... }        │
│ >>>>>>> seu-commit                     │
└────────────────────────────────────────┘

RESOLUÇÃO:
═════════════════════════════════════════════════════

1. Abrir arquivo auth.tsx
2. Decidir qual versão manter (ou combinar)
3. Remover <<<< ==== >>>> markers
4. Salvar arquivo
5. git add auth.tsx
6. git rebase --continue

Resultado:
  feature/seu-nome (agora sincronizado com develop + seu código)

Fazer push:
  git push origin --force-with-lease
  (force-with-lease é seguro, força-com-verificação)
```

---

## 8. Status do Repositório

```
Seu ambiente local:

working-directory (onde você edita)
         ↓ git add
    staging-area (preparado para commit)
         ↓ git commit
    local-commits (seu branch local)
         ↓ git push
    remote-branch (no GitHub)

Comandos úteis para ver status:

git status
───────────
  On branch: feature/seu-nome
  Changes not staged for commit:
    - src/components/KPI.tsx (modificado)
  
  Untracked files:
    - src/new-file.tsx

git log --oneline
─────────────────────
  abc1234 feat: seu commit
  def5678 feat: outro dev
  ...

git branch -a
──────────────
  * feature/seu-nome
    develop
    main
    remotes/origin/develop
    remotes/origin/main
    remotes/origin/feature/seu-nome
```

---

## Referência Rápida

```bash
# Checklist: Feature → Merge

□ git checkout develop
□ git pull origin develop
□ git checkout -b feature/descricao

  ... editar código ...

□ git add .
□ git commit -m "feat(escopo): descrição"
□ git push -u origin feature/descricao

  ... abrir PR no GitHub ...
  ... aguardar CI ✅ ...
  ... solicitar review ...
  ... responder comentários ...

□ Merge PR (Squash and merge)
□ git checkout develop
□ git pull origin develop
□ git branch -d feature/descricao

✅ Pronto para próxima feature!
```

---

**Última atualização**: 2025-06-13  
**Dúvidas?** Consulte [GIT_WORKFLOW.md](GIT_WORKFLOW.md) ou [ONBOARDING.md](ONBOARDING.md)
