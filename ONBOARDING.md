# Onboarding para Desenvolvedores

Bem-vindo ao projeto **Controle OS**! Este guia te ajuda a se integrar rapidamente ao fluxo de trabalho.

## 5 Minutos: Setup Inicial

### 1. Clone o repositório

```bash
git clone https://github.com/Kauast/controle-os-next.git
cd controle-os-next
```

### 2. Configurar Git pessoal

```bash
git config user.name "Seu Nome Completo"
git config user.email "seu.email@empresa.com"

# Verificar
git config user.name    # Deve mostrar seu nome
```

### 3. Instalar Git Hooks

```bash
bash scripts/setup-git-hooks.sh
```

Isso ativa validações automáticas ao fazer commit.

### 4. Instalar dependências

```bash
npm install

# Backend também
cd backend-senior
npm install
cd ..
```

### 5. Configurar variáveis de ambiente

```bash
# Frontend
cp .env.example .env.local
nano .env.local    # Editar conforme necessário

# Backend
cd backend-senior
cp .env.example .env
nano .env         # Editar conforme necessário
cd ..
```

### 6. Subir banco de dados e Redis

```bash
docker compose -f backend-senior/docker-compose.yml up -d
```

### 7. Rodar em desenvolvimento

```bash
# Terminal 1 — Backend
cd backend-senior
npx prisma migrate deploy
npm run seed    # Uma única vez
npm run dev

# Terminal 2 — Frontend (nova janela)
npm run dev
```

Pronto! Acesse [http://localhost:3000](http://localhost:3000)

---

## Entender o Git Workflow

### Estrutura de Branches

```
main (produção)
  ↓
develop (desenvolvimento)
  ↓
feature/seu-nome (onde você trabalha)
```

**Regra de ouro**: Sempre trabalhe em uma branch `feature/...`, nunca direto em `main` ou `develop`.

### Seu Primeiro Commit

```bash
# 1. Sincronizar com develop
git checkout develop
git pull origin develop

# 2. Criar sua branch de feature
git checkout -b feature/seu-primeiro-teste

# 3. Fazer uma mudança simples (ex: adicionar seu nome a um arquivo)
echo "seu nome" >> CONTRIBUTORS.md

# 4. Ver status
git status

# 5. Fazer commit
git add CONTRIBUTORS.md
git commit -m "docs: adiciona seu-nome aos contribuidores"

# 6. Verificar que commit saiu bem
git log --oneline -1

# 7. Fazer push para origem
git push -u origin feature/seu-primeiro-teste

# 8. No GitHub, abrir PR para develop
```

### Mensagens de Commit

Usamos **Conventional Commits**. Formato:

```
<tipo>(<escopo>): <descrição breve>
```

**Tipos**: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, `ci`, `style`

**Exemplos**:
- `feat(auth): implementa login com Google`
- `fix(backend): corrige erro de validação de email`
- `docs: atualiza README com passo de deploy`

---

## Fluxo Básico: Feature → Merge

### 1. Criar feature

```bash
git checkout develop
git pull origin develop
git checkout -b feature/nova-funcionalidade
```

### 2. Desenvolver

```bash
# Editar arquivos, fazer commits...
git add .
git commit -m "feat(pagina): implementa novo painel de KPIs"
```

### 3. Sincronizar com develop (se fez muitos commits)

```bash
git fetch origin
git rebase origin/develop
# Se conflitos: resolver + git rebase --continue
```

### 4. Fazer push

```bash
git push origin feature/nova-funcionalidade
```

### 5. Abrir Pull Request

- Ir para: https://github.com/Kauast/controle-os-next/pulls
- New Pull Request
- De: `feature/nova-funcionalidade`
- Para: `develop`
- Preencher template (título, descrição, checklist)
- Criar PR

### 6. Aguardar review e CI

- GitHub Actions roda testes (vê em "Checks")
- Dev senior revisa código
- Responder comentários (novos commits se necessário)

### 7. Merge

Após aprovação (✅ check mark) e CI passar:
- Clicar "Squash and merge" (recomendado para limpar history)
- Deletar branch remota (checkbox)

```bash
# Localmente, cleanup
git checkout develop
git pull origin develop
git branch -d feature/nova-funcionalidade
```

---

## Boas Práticas

### ✅ Faça

- Commits pequenos e atômicos (cada commit é um "change" lógico)
- Mensagens descritivas ("Implementa X" não "fix bugs")
- Puxar `develop` regularmente para evitar conflicts
- Conversar antes de fazer refactor grande
- Testar localmente antes de push

```bash
# Exemplo: 3 commits pequenos para uma feature
git commit -m "feat(forms): adiciona campo de categoria"
git commit -m "test(forms): testes para validação de categoria"
git commit -m "docs: atualiza API doc com novo endpoint"
```

### ❌ Evite

- Commits gigantes com múltiplas features
- Mensagens vagas ("update", "fix", "changes")
- Fazer push direto em `main` ou `develop`
- Mergear sem passar por PR
- Commitar secrets (.env, chaves, senhas)

```bash
# ❌ Ruim
git commit -m "changes"

# ✅ Bom
git commit -m "feat(auth): implementa refresh token com 7 dias de validade"
```

---

## Troubleshooting Comum

### "Permission denied" ao fazer push

```bash
# Verificar que está autenticado no GitHub
git config user.email
# Deve ser seu email real (não noreply.github.com)

# Pode precisar fazer login novamente
git credential-manager erase https://github.com
# Tentar push novamente
```

### "Your branch is behind origin/develop"

```bash
# Sincronizar com remote
git fetch origin
git rebase origin/develop
```

### Fez commit errado

```bash
# Desfazer último commit (mantém mudanças)
git reset --soft HEAD~1

# Ou descartar completamente
git reset --hard HEAD~1
```

### Deletou branch por acidente

```bash
# Ver reflog
git reflog
# Output: abc1234 feature/deletada

# Recriar
git checkout -b feature/deletada abc1234
```

---

## Recursos Úteis

- 📖 **Guia Completo**: [GIT_WORKFLOW.md](GIT_WORKFLOW.md)
- 🏗️ **Arquitetura**: [ARQUITETURA_ENTERPRISE.md](ARQUITETURA_ENTERPRISE.md)
- 📚 **README**: [README.md](README.md)

---

## Checklist Final

Antes de começar a trabalhar:

- [ ] Clone repo e rode `npm install`
- [ ] Rodou `scripts/setup-git-hooks.sh`
- [ ] Configurou `git config user.name` e `user.email`
- [ ] Backend + Frontend rodando localmente
- [ ] Abriu uma PR de teste para entender o fluxo
- [ ] Leu [GIT_WORKFLOW.md](GIT_WORKFLOW.md) — pelo menos os primeiros 3 seções

---

## Dúvidas?

- 💬 Pergunte no Slack/Discord (seu-canal-dev)
- 📧 Email: seu-email-lead@empresa.com
- 📝 Abra uma issue com tag `question`
- 🔄 Feedback? Melhore este doc!

---

**Bem-vindo ao time! 🎉**
