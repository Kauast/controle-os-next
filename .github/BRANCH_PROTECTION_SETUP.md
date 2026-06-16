# Configuração de Proteção de Branches

Guia passo-a-passo para configurar branch protection rules no GitHub.

## Por que proteger branches?

- ✅ Previne pushes acidentais a main/develop
- ✅ Força reviews de código antes de merge
- ✅ Garante que CI passa antes de merge
- ✅ Mantém history limpo e rastreável

---

## Setup: Branch `main` (Produção)

### 1. Abrir Configurações do Repositório

- Ir para: https://github.com/Kauast/controle-os-next/settings
- Lado esquerdo: "Branches"
- Seção: "Branch protection rules"
- Clique: "Add rule"

### 2. Configurar Rule para `main`

**Branch name pattern:**
```
main
```

### 3. Require status checks to pass before merging

✅ Ativar: "Require status checks to pass before merging"

**Status checks obrigatórios** (selecionar todos):
- `Lint & Format Check`
- `Backend — typecheck, tests, lint`
- `Frontend — typecheck, build, lint`
- `Docker — build images & validate compose`
- `Security — env check & vulnerabilities`
- `CI Summary`

✅ Ativar: "Require branches to be up to date before merging"

### 4. Require a pull request before merging

✅ Ativar: "Require a pull request before merging"

**Number of required approvals:**
```
1
```

✅ Ativar: "Require review from Code Owners"
(Usa arquivo `.github/CODEOWNERS`)

✅ Ativar: "Dismiss stale pull request approvals when new commits are pushed"
(Força re-review após novo commit)

### 5. Require signed commits

✅ Ativar: "Require commits to be signed"
(Opcional, recomendado para segurança)

### 6. Restrictions

✅ Ativar: "Restrict who can push to matching branches"

**Permitir push apenas para:**
- @Kauast (seu usuário de admin)
- Ou deixar vazio se todos devem usar PR

### 7. Admin overrides

❌ Desativar: "Allow force pushes"
(Nunca permitir -- garante history limpo)

❌ Desativar: "Allow deletions"
(Nunca deletar main)

### 8. Salvar

Clique: "Create" (ou "Update" se editando)

---

## Setup: Branch `develop` (Desenvolvimento)

**Repetir processo acima COM DIFERENÇAS:**

**Branch name pattern:**
```
develop
```

**Status checks obrigatórios:** (Idem à main)
- Todos mencionados acima

**Require a pull request before merging:**
✅ Ativar com 1 approval

**Require signed commits:**
❌ Desativar (mais permissivo em dev)

**Restrict who can push:**
❌ Desativar (devs podem pushear branches de feature direto)

**Admin overrides:**
❌ Desativar force pushes
❌ Desativar deletions

---

## Setup: Branches de Feature (`feature/*`)

✅ **OPCIONAL** — Recomendado apenas para times grandes

**Branch name pattern:**
```
feature/*
```

**Configurações mínimas:**
- Require status checks: ❌ (rápido em dev)
- Require review: ❌ (rápido em dev)
- Restrict who can push: ❌ (devs precisam liberdade)

---

## GitHub Actions: Auto-delete feature branches

Deletar automaticamente branches mergeadas:

**Configuração automática:**
Settings → General → "Automatically delete head branches"

✅ Ativar

Isto deleta a branch remota automaticamente após merge de PR.

---

## Configurar CODEOWNERS para auto-request de reviews

Arquivo: `.github/CODEOWNERS` (já criado)

**Exemplo:**
```
# Backend — pedir review de dev backend
backend-senior/ @usuario-backend

# Frontend — pedir review de dev frontend
src/ @usuario-frontend

# Infra — pedir review de devops
docker-compose.yml @usuario-devops
```

Quando PR tocar esses arquivos, GitHub automaticamente solicita review.

---

## Verificar se está funcionando

### 1. Testar sem PR (deve falhar)

```bash
# Tentar fazer push direto em main (vai falhar)
git checkout main
git commit -m "test"
git push origin main

# Output: "Your branch is ahead of origin/main..."
# Mas GitHub recusa com erro no push
```

### 2. Testar com PR (deve passar)

```bash
# Criar feature e PR
git checkout -b feature/test-branch-protection
git commit -m "test: validação de branch protection"
git push -u origin feature/test-branch-protection
```

- Abrir PR no GitHub
- Ver que "Checks" roda (CI)
- Ver que precisa de 1 review
- Solicitar review a si mesmo
- Aprovar PR
- Clicar "Merge" (deve estar verde)

### 3. Deletar feature branch

```bash
# No GitHub: checkbox "Delete branch" após merge
# Ou manualmente:
git branch -D feature/test-branch-protection
git push origin --delete feature/test-branch-protection
```

---

## Monitorar violações

### No GitHub

- Settings → Branches → Ver "Protection rules"
- Clique na rule para ver histórico de bypasses

### Logs

```bash
# Ver quem fez push em main
git log main --oneline | head -20

# Ver merges
git log --merges main --oneline | head -10
```

---

## Troubleshooting

### "Review required" bloqueia merge

Status correto! Você precisa:
1. ✅ CI passar (verde)
2. ✅ 1 aprovação
3. ✅ Branch atualizada com `main`

```bash
# Se branch está atrás:
git fetch origin
git rebase origin/main
git push origin --force-with-lease
```

### "Push rejected" ao fazer push

Esperado em `main` e `develop`. Use PR:

```bash
git checkout -b feature/seu-nome
git push origin feature/seu-nome
# Depois abrir PR
```

### Preciso fazer emergency bypass

**⚠️ Apenas admin pode fazer isto!**

Settings → Branches → "Allow" temporariamente e depois:
1. Desabilitar rule
2. Fazer push/merge
3. Re-habilitar rule

**Nunca** desabilitar permanentemente!

---

## Checklist Final

- [ ] Protegida branch `main` com 1 approval + CI
- [ ] Protegida branch `develop` com 1 approval + CI
- [ ] `.github/CODEOWNERS` configurado
- [ ] "Automatically delete head branches" ativado
- [ ] Testado fazendo uma PR de teste
- [ ] Team entende o fluxo

---

## Referencias

- [GitHub: Protected Branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)
- [GitHub: CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)

Dúvidas? Abrir issue com label `git-workflow`.
