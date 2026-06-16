# Git Workflow — Quick Reference

Guia rápido para consultar enquanto desenvolve.

---

## 60 Segundos: Setup Inicial

```bash
# Clone e configure (primeira vez)
git clone https://github.com/Kauast/controle-os-next.git
cd controle-os-next

git config user.name "Seu Nome"
git config user.email "seu.email@empresa.com"

bash scripts/setup-git-hooks.sh

npm install
```

---

## Fluxo Diário: Feature → Merge

```bash
# 1. PREPARE
git checkout develop
git pull origin develop
git checkout -b feature/descricao

# 2. DEVELOP
git add .
git commit -m "feat(escopo): descrição clara"

# Múltiplos commits são OK:
git commit -m "test(escopo): adiciona testes"
git commit -m "docs: atualiza README"

# 3. SINCRONIZE (se muito tempo passou)
git fetch origin
git rebase origin/develop
# Se conflitos: resolver + git rebase --continue

# 4. PUSH
git push -u origin feature/descricao

# 5. OPEN PR no GitHub
# De: feature/descricao
# Para: develop
# Preencher template

# 6. MERGE (após ✅ CI + ✅ Review)
# No GitHub: Squash and merge

# 7. CLEANUP
git checkout develop
git pull origin develop
git branch -d feature/descricao
```

---

## Commit Message Format

```
<tipo>(<escopo>): <descrição breve>

[corpo opcional com mais detalhes]

[footer opcional: Closes #123]
```

**Tipos**: `feat` `fix` `docs` `refactor` `perf` `test` `chore` `ci` `style` `revert`

**Exemplos**:
```
feat(auth): implementa login OAuth2
fix(backend): corrige validação de email
docs: atualiza setup.md
perf(frontend): otimiza renderização de listas
test(api): adiciona testes de endpoint
```

---

## Branch Naming

```
feature/<descricao>       ← Nova funcionalidade
bugfix/<descricao>        ← Correção em desenvolvimento
hotfix/<descricao>        ← Bug crítico em produção
release/v<x.y.z>         ← Preparar release
```

**Evitar**: `update`, `temp`, `test`, `wip`

---

## Comandos Essenciais

### Ver Status

```bash
git status                          # Status atual
git log --oneline -5                # Últimos 5 commits
git branch -a                       # Todas as branches
git diff                            # Mudanças não staged
git diff --cached                   # Mudanças staged
```

### Commit & Push

```bash
git add <arquivo>                   # Preparar arquivo específico
git add .                           # Preparar tudo
git commit -m "msg"                 # Fazer commit
git push origin <branch>            # Enviar para GitHub
git push -u origin <branch>         # Enviar + rastrear
```

### Sincronizar

```bash
git fetch origin                    # Buscar atualizações
git pull origin develop             # Buscar + merge
git rebase origin/develop           # Buscar + rebase (preferido)
```

### Desfazer

```bash
git reset src/arquivo.ts            # Remover stage
git checkout -- src/arquivo.ts      # Descartar mudanças
git reset --soft HEAD~1             # Desfazer commit (mantém código)
git reset --hard HEAD~1             # Desfazer commit (descarta código)
git revert abc1234                  # Cria commit de undo
```

---

## Problemas Rápidos

| Problema | Solução |
|----------|---------|
| "branch is behind" | `git fetch origin && git rebase origin/develop` |
| Conflito merge | Resolver arquivos, `git add .`, `git rebase --continue` |
| Mensagem errada | `git commit --amend -m "nova msg"` |
| Deletou branch | `git reflog` → `git checkout -b branch <hash>` |
| Permission denied | `ssh -T git@github.com` e registrar chave SSH |
| Unstaged changes | `git add .` ou `git stash` |

→ Mais em [GIT_TROUBLESHOOTING.md](GIT_TROUBLESHOOTING.md)

---

## Status Checks — O que significa cada um?

```
✅ Lint & Format Check
   → ESLint passou, código está bem formatado

✅ Backend — typecheck, tests, lint
   → TypeScript OK, testes passaram, lint OK

✅ Frontend — typecheck, build, lint
   → TypeScript OK, build passou, lint OK

✅ Docker — build images & validate compose
   → Imagens buildaram, docker-compose válido

✅ Security — env check & vulnerabilities
   → Nenhum .env commitado, sem secrets detectados

✅ Commits — validar Conventional Commits
   → Todas as mensagens seguem formato correto

🟢 All checks passed = PR pronta para merge!
```

---

## Pull Request Checklist

Antes de abrir PR:

- [ ] `npm run lint` — sem erros
- [ ] `npm run build` — build passa
- [ ] Testes locais passam
- [ ] Nenhum `.env` commitado
- [ ] Branch sincronizada com `develop`
- [ ] Commits com Conventional Commits format
- [ ] PR template preenchido

---

## Hotfix (Bug em Produção)

```bash
# RÁPIDO!
git checkout main
git pull origin main
git checkout -b hotfix/bug-critico

# Corrigir bug
git commit -m "fix(auth): corrige crash no login"
git push -u origin hotfix/bug-critico

# Abrir PR: hotfix/bug-critico → main
# Após merge em main:

# Sincronizar develop
git checkout develop
git cherry-pick <commit-do-fix>
git push origin develop
# ou abrir novo PR: hotfix/... → develop
```

---

## Release (Versão Nova)

```bash
git checkout develop
git pull origin develop
git checkout -b release/v1.3.0

# Atualizar versão
# - package.json: "version": "1.3.0"
# - CHANGELOG.md: adicionar seção 1.3.0

git commit -m "chore: bump version 1.3.0"
git push -u origin release/v1.3.0

# Abrir PR: release/v1.3.0 → main
# Após merge:

git checkout develop
git pull origin develop
git merge main  # ou git pull origin main
git push origin develop
```

---

## Admin Tasks

### Habilitar Branch Protection (Settings)

```
main branch:
  ✅ Require status checks
  ✅ Require 1 review
  ✅ Require CODEOWNERS review
  ❌ Allow force pushes

develop branch:
  ✅ Require status checks
  ✅ Require 1 review
  ❌ Allow force pushes
```

→ Ver [.github/BRANCH_PROTECTION_SETUP.md](.github/BRANCH_PROTECTION_SETUP.md)

### Configurar Secrets (Settings → Secrets)

```
VPS_HOST = seu-dominio.com
VPS_USER = deploy_user
VPS_SSH_KEY = private key
VPS_SSH_PORT = 22
```

---

## Documentação Completa

| Arquivo | Para quem | Conteúdo |
|---------|-----------|----------|
| [GIT_WORKFLOW.md](GIT_WORKFLOW.md) | Todos | Estratégia completa de branches e PRs |
| [ONBOARDING.md](ONBOARDING.md) | Novos devs | Setup de 5 minutos |
| [GIT_VISUAL_GUIDE.md](GIT_VISUAL_GUIDE.md) | Visuais | Diagramas ASCII de fluxos |
| [GIT_TROUBLESHOOTING.md](GIT_TROUBLESHOOTING.md) | Quando erros | Soluções para problemas comuns |
| [.github/BRANCH_PROTECTION_SETUP.md](.github/BRANCH_PROTECTION_SETUP.md) | Admin | Setup de proteção de branches |

---

## Dúvidas Rápidas

**P: Onde faço commits?**
A: Em `feature/seu-nome`, nunca direto em `main` ou `develop`.

**P: Como abrir PR?**
A: Push a branch, ir para GitHub, clicar "New Pull Request".

**P: Quantos commits devo fazer?**
A: Quantos forem necessários. Cada commit = mudança lógica.

**P: Devo fazer `rebase` ou `merge`?**
A: Rebase (mais limpo). Depois Squash and merge no PR.

**P: E se alguém mergeou algo que conflita?**
A: Resolver conflict localmente, depois fazer push.

---

## Git Setup Once (por máquina)

```bash
# Global config
git config --global user.name "Seu Nome"
git config --global user.email "seu.email@empresa.com"

# GPG signing (opcional)
# git config --global commit.gpgsign true

# Alias úteis
git config --global alias.lg "log --oneline --graph --all"
git config --global alias.st "status"
git config --global alias.ck "checkout"
git config --global alias.cm "commit"
git config --global alias.p "push origin"
git config --global alias.pl "pull origin"
```

Depois:
```bash
git lg          # Em vez de git log ...
git st          # Em vez de git status
git ck develop  # Em vez de git checkout develop
```

---

## Atalhos Úteis (IDE/Editor)

### VS Code

- `Ctrl + Shift + G` — Abrir Git panel
- `Ctrl + K Ctrl + S` — Ver atalhos
- Instalar: GitLens (mais info de blame/history)

### GitHub Desktop

- GUI visualmente mais clara
- Bom para iniciantes
- Ainda assim use terminal para desenvolvimento

### Command Line Pro Tips

```bash
# Ver configuração atual
git config --list

# Log com gráfico lindo
git log --oneline --graph --all --decorate

# Ver arquivos que estão staged
git diff --cached --name-only

# Ver commits que ainda não foram pushados
git log origin/develop..HEAD

# Stash com nome
git stash save "trabalho em progresso"
git stash list
git stash pop stash@{0}
```

---

## Recursos Externos

- 📖 [Official Git Book](https://git-scm.com/book/en/v2)
- 🎓 [GitHub Learning Lab](https://lab.github.com)
- 💬 [GitHub Community](https://github.community)
- 🔍 [Stackoverflow Git Tag](https://stackoverflow.com/questions/tagged/git)

---

**Última atualização**: 2025-06-13  
**Versão**: 1.0  
**Status**: Pronto para produção ✅

Dúvidas? → [GIT_WORKFLOW.md](GIT_WORKFLOW.md) ou abrir issue.
