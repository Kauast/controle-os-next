# Git Troubleshooting — Soluções Rápidas

Soluções para problemas comuns ao trabalhar com Git.

---

## Problemas de Sincronização

### "Your branch is behind origin/develop"

**Problema**: Seu código local não tem as mudanças recentes do remote.

**Causa**: Outro dev fez merge enquanto você estava trabalhando.

**Solução**:

```bash
# 1. Buscar mudanças do remote
git fetch origin

# 2. Verificar a diferença
git log --oneline develop..origin/develop
# Mostra commits que faltam

# 3. Atualizar sua branch
git rebase origin/develop

# ou, se preferir merge
git merge origin/develop

# 4. Verificar status
git status
# Deve mostrar: "Your branch is ahead of origin/develop by X commits"
```

**Melhor prática**: Sempre fazer `git pull` antes de criar feature:

```bash
git checkout develop
git pull origin develop
git checkout -b feature/nova-feature
```

---

### "Your branch is ahead of origin by X commits"

**Problema**: Você tem commits locais que ainda não foram enviados.

**Solução**:

```bash
# Se deseja manter commits, fazer push
git push origin feature/seu-nome

# Se deseja descartar localmente
git reset --hard origin/feature/seu-nome
```

---

## Problemas de Merge/Rebase

### Conflito de merge ao fazer rebase

**Problema**: 

```
error: CONFLICT (content): Merge conflict in src/auth.ts
CONFLICT (delete/modify): backend-senior/config.ts deleted in HEAD
...
```

**Solução passo-a-passo**:

```bash
# 1. Ver quais arquivos têm conflito
git status

# Output:
# both modified: src/auth.ts
# deleted by them: backend-senior/config.ts

# 2. Abrir src/auth.ts e procurar por markers
#    <<<<<<< HEAD
#    |código de origem|
#    =======
#    |seu código|
#    >>>>>>> branch-name

# 3. Resolver manualmente: escolher qual versão manter
#    Opção 1: Manter seu código (remover <<<< ==== >>>>)
#    Opção 2: Manter código de origem
#    Opção 3: Combinar ambos

# 4. Para arquivo deletado, decidir
git rm backend-senior/config.ts    # Manter deleção
# ou
git add backend-senior/config.ts   # Manter arquivo

# 5. Marcar como resolvido
git add src/auth.ts

# 6. Continuar rebase
git rebase --continue

# 7. Se houver mais conflitos, repetir 3-6
# Se estiver OK, será criado novo commit

# 8. Fazer push com force (safe)
git push origin --force-with-lease
```

**Usar merge tool gráfica**:

```bash
# Se instalou mergetool (ex: Beyond Compare, VSCode)
git config merge.tool vscode
git rebase --continue
# VSCode abre para resolver conflicts graficamente
```

---

### "cannot rebase: you have unstaged changes"

**Problema**: Você tem mudanças que não foram commitadas.

**Solução**:

```bash
# Opção 1: Commitar antes de rebase
git add .
git commit -m "work in progress"
git rebase origin/develop

# Opção 2: Stash (guardar temporariamente)
git stash                          # Guardar mudanças
git rebase origin/develop
git stash pop                      # Recuperar mudanças

# Opção 3: Descartar mudanças (⚠️ cuidado!)
git reset --hard
git rebase origin/develop
```

---

## Problemas de Commits

### Corrigir mensagem de commit

**Problema**: Fez commit com mensagem errada.

**Solução**:

```bash
# Amend último commit (não foi feito push ainda)
git commit --amend -m "nova mensagem"

# ou para editar interativamente
git commit --amend

# Se já fez push, fazer reset e repush
git reset --soft HEAD~1
git add .
git commit -m "mensagem corrigida"
git push origin --force-with-lease
```

---

### Desfazer últimos commits

**Problema**: Fez vários commits que deseja descartar.

**Solução**:

```bash
# Desfazer últimos 3 commits (mantém mudanças)
git reset --soft HEAD~3

# Desfazer últimos 3 commits (descarta mudanças)
git reset --hard HEAD~3

# Desfazer último commit específico (mantém mudanças)
git reset --soft <commit-hash>

# Ver histórico se se arrependeu
git reflog
git reset --hard <reflog-hash>
```

**Para commits já feito push**:

```bash
# Usar revert (cria novo commit de desfazimento)
git revert abc1234
git push origin

# Ou fazer reset + force push (cuidado!)
git reset --hard HEAD~3
git push origin --force-with-lease
```

---

### Esqueci de adicionar um arquivo ao último commit

**Solução**:

```bash
# Opção 1: Amend (se não fez push)
git add arquivo-esquecido.ts
git commit --amend --no-edit
git push origin --force-with-lease

# Opção 2: Novo commit (se já fez push)
git add arquivo-esquecido.ts
git commit -m "fix: adiciona arquivo que faltou"
git push origin
```

---

## Problemas de Push/Pull

### "Permission denied (publickey)"

**Problema**: Erro ao fazer push (autenticação SSH falhou).

**Solução**:

```bash
# 1. Verificar se chave SSH está registrada
ssh -T git@github.com

# Se falhar: "Permission denied", gerar nova chave
ssh-keygen -t ed25519 -C "seu.email@empresa.com"
# Salvar em: ~/.ssh/id_ed25519

# 2. Adicionar chave ao GitHub
cat ~/.ssh/id_ed25519.pub
# Copiar e colar em: Settings → SSH and GPG keys → New SSH key

# 3. Testar novamente
ssh -T git@github.com
# Deve mostrar: "Hi username! You've successfully authenticated..."

# 4. Tentar push novamente
git push origin feature/seu-nome
```

**Alternativa com HTTPS (token)**:

```bash
# Se preferir usar HTTPS ao invés de SSH
git remote set-url origin https://github.com/Kauast/controle-os-next.git

# Criar token no GitHub: Settings → Developer settings → Personal access tokens
# Usar token como senha ao fazer push

git push origin feature/seu-nome
# Username: seu-username
# Password: seu-github-token (não sua senha real)
```

---

### "fatal: The current branch has no upstream branch"

**Problema**: Branch local não rastreada no remote.

**Solução**:

```bash
# Ao fazer push primeira vez, usar -u
git push -u origin feature/seu-nome

# Ou configurar manualmente
git branch --set-upstream-to=origin/feature/seu-nome feature/seu-nome

# Verificar
git branch -vv
# Deve mostrar: feature/seu-nome   abc1234 [origin/feature/seu-nome] commit message
```

---

### "fatal: refusing to merge unrelated histories"

**Problema**: Duas histories de Git conflitantes (ex: pull de unrelated branch).

**Solução**:

```bash
# Force merge mesmo com histories diferentes
git pull origin develop --allow-unrelated-histories

# ou para rebase
git rebase origin/develop --allow-unrelated-histories
```

---

## Problemas de Branch

### Deletei branch local por acidente

**Problema**: Fiz `git branch -D feature/importante` sem querer.

**Solução**:

```bash
# Ver reflog (histórico de movimentações)
git reflog

# Output:
# abc1234 HEAD@{0}: checkout: moving from feature/importante to develop
# def5678 HEAD@{1}: commit: feat: minha feature importante
# ...

# Recriar branch a partir do commit
git checkout -b feature/importante abc1234

# ou se sabe o nome original
git reflog show feature/importante
git checkout -b feature/importante <commit-hash>
```

---

### Deletei branch remota sem querer

**Problema**: Fiz `git push origin --delete feature/importante` sem querer.

**Solução**:

```bash
# Se ainda tem local, fazer push
git push -u origin feature/importante

# Se deletou tudo, usar reflog do remote
git reflog show origin/feature/importante

# Recriar
git checkout -b feature/importante <commit-hash>
git push -u origin feature/importante
```

---

### Quero renomear uma branch

**Solução**:

```bash
# Renomear branch local
git branch -m feature/nome-antigo feature/nome-novo

# Deletar branch antiga no remote
git push origin --delete feature/nome-antigo

# Fazer push com novo nome
git push -u origin feature/nome-novo
```

---

## Problemas de Status

### Mudanças não aparecem no `git status`

**Problema**: Editou arquivo mas `git status` não mostra.

**Solução**:

```bash
# Pode ser que .gitignore está ignorando
git check-ignore -v caminho/do/arquivo.ts

# Se arquivo deve ser rastreado, remover de .gitignore
# ou forçar adicionar
git add -f caminho/do/arquivo.ts
```

---

### "Untracked files" que não desejo commitar

**Problema**: Arquivos aparecem em `git status` mas não quer commitar.

**Solução**:

```bash
# Adicionar a .gitignore
echo "node_modules/" >> .gitignore
echo ".env.local" >> .gitignore
git add .gitignore
git commit -m "chore: update .gitignore"

# Se arquivo já estava rastreado, remover do tracking
git rm --cached caminho/do/arquivo
git add .gitignore
git commit -m "chore: remove cached file from tracking"
```

---

## Problemas Críticos

### "detached HEAD state"

**Problema**: 

```
You are in 'detached HEAD' state. You can look around, make experimental
changes and commit them...
```

**Causa**: Fez checkout de um commit direto em vez de uma branch.

**Solução**:

```bash
# Ver commits que fez no detached state
git log --oneline -5

# Opção 1: Descartar mudanças e voltar para branch
git checkout develop

# Opção 2: Criar branch a partir do detached state
git checkout -b feature/backup-from-detached
git push -u origin feature/backup-from-detached
```

---

### "fatal: pathspec 'arquivo' did not match any files"

**Problema**: Tentou fazer `git add arquivo` mas Git não encontrou.

**Solução**:

```bash
# Verificar nome do arquivo (case-sensitive!)
ls -la | grep arquivo

# Adicionar com caminho correto
git add ./seu-caminho/arquivo.ts

# ou adicionar tudo
git add .
```

---

### Preciso fazer reset de TUDO

**Problema**: Desastre total, quer descartar tudo e começar limpo.

**⚠️ CUIDADO — Isto é destrutivo!**

```bash
# Descartar todas mudanças locais
git reset --hard origin/develop

# Limpar arquivos não rastreados
git clean -fd

# Resultado: seu repo local = remoto exatamente
```

**Se quer voltar tudo mas salvando em branch**:

```bash
git checkout -b feature/backup-before-reset
git reset --hard origin/develop
# Agora tem branch 'feature/backup-before-reset' com código antigo
```

---

## Problemas de Performance

### Clone muito lentoooo

**Solução**:

```bash
# Clone shallow (sem histórico completo)
git clone --depth 1 https://github.com/Kauast/controle-os-next.git

# Depois buscar histórico completo se necessário
git fetch --unshallow

# ou clonar com single branch
git clone --single-branch --branch develop \
  https://github.com/Kauast/controle-os-next.git
```

---

### Rebase com muitos commits está lento

**Solução**:

```bash
# Usar autosquash (mais rápido)
git rebase -i --autosquash origin/develop

# ou fazer rebase multi-threaded
git config rebase.maxParallel 4
git rebase origin/develop
```

---

## Debug & Investigação

### Descobrir quem fez uma mudança específica

```bash
# Blame: mostra commit e autor de cada linha
git blame src/arquivo.ts

# Ver commit específico
git show abc1234

# Ver arquivo em commit específico
git show abc1234:src/arquivo.ts
```

---

### Encontrar commit que quebrou algo

```bash
# Bisect: busca binária para encontrar commit ruim
git bisect start

# Marcar commit como ruim
git bisect bad

# Ir para commit antigo que funcionava
git checkout abc1234
git bisect good

# Git automaticamente testa commits no meio
# Responder bad/good até achar commit problemático
git bisect bad
git bisect good
...

# Sair de bisect
git bisect reset
```

---

### Ver todos os commits não mergeados

```bash
# Commits que estão em sua branch mas não em main
git log main..HEAD --oneline

# Commits que estão em main mas não em sua branch
git log HEAD..main --oneline
```

---

## Comandos de Emergência

```bash
# SOS: Desfazer tudo exceto último commit
git reset --soft HEAD~1

# SOS: Descartar todas mudanças e voltar ao remote
git reset --hard origin/develop
git clean -fd

# SOS: Ver tudo que foi feito
git reflog

# SOS: Recuperar commit "perdido"
git fsck --lost-found

# SOS: Limpar cache if credenciais
git credential-manager erase https://github.com
```

---

## Checklist: Resolvendo Problema

1. ⚠️ **NÃO PANIQUE** — Git quase sempre permite recuperar
2. 📝 Anote a mensagem de erro exata
3. 🔍 Procure por erro em [GIT_TROUBLESHOOTING.md](GIT_TROUBLESHOOTING.md)
4. 🧪 Tente solução em branch de teste, não em main
5. 💬 Se preso, pedir help: GitHub, Slack, email
6. 📚 Documentar solução para futuro

---

## Referências

- [Git Official Docs](https://git-scm.com/doc)
- [GitHub Help](https://docs.github.com)
- [Atlassian Git Tutorials](https://www.atlassian.com/git/tutorials)

---

**Última atualização**: 2025-06-13  
**Seu problema não está aqui?** Abrir issue em GitHub ou perguntar no time.
