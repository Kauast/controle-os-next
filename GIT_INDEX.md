# Git Workflow — Índice Completo

Mapa completo da documentação de Git Workflow para o projeto **Controle OS**.

---

## 🚀 Começar Rápido

**Tempo**: 5-10 minutos

1. Leia: [ONBOARDING.md](ONBOARDING.md) — Setup inicial completo
2. Atalho: [GIT_QUICK_REFERENCE.md](GIT_QUICK_REFERENCE.md) — Comandos essenciais

**Status**: Pronto para fazer sua primeira feature!

---

## 📚 Documentação por Perfil

### Para Desenvolvedores Iniciantes

| Arquivo | Descrição | Tempo |
|---------|-----------|-------|
| [ONBOARDING.md](ONBOARDING.md) | Setup local de 5 minutos | 5 min |
| [GIT_QUICK_REFERENCE.md](GIT_QUICK_REFERENCE.md) | Cheat sheet de comandos | 3 min |
| [GIT_VISUAL_GUIDE.md](GIT_VISUAL_GUIDE.md) | Diagramas e fluxos visuais | 10 min |
| [GIT_TROUBLESHOOTING.md](GIT_TROUBLESHOOTING.md) | Soluções para problemas | Por demanda |

**Primeira semana:**
1. Complete [ONBOARDING.md](ONBOARDING.md)
2. Faça sua primeira feature seguindo [GIT_VISUAL_GUIDE.md](GIT_VISUAL_GUIDE.md#fluxo-de-feature-completo)
3. Consulte [GIT_TROUBLESHOOTING.md](GIT_TROUBLESHOOTING.md) se ficar preso

---

### Para Desenvolvedores Experientes

| Arquivo | Descrição |
|---------|-----------|
| [GIT_WORKFLOW.md](GIT_WORKFLOW.md) | Estratégia completa (Git Flow) |
| [GIT_QUICK_REFERENCE.md](GIT_QUICK_REFERENCE.md) | Referência rápida de comandos |
| [.github/BRANCH_PROTECTION_SETUP.md](.github/BRANCH_PROTECTION_SETUP.md) | Configuração de proteção |
| [.github/pull_request_template.md](.github/pull_request_template.md) | Template de PR |

**Setup rápido:**
1. Rode `bash scripts/setup-git-hooks.sh`
2. Consulte [GIT_QUICK_REFERENCE.md](GIT_QUICK_REFERENCE.md) para atalhos
3. Leia [GIT_WORKFLOW.md](GIT_WORKFLOW.md) seção "Convenção de Commits"

---

### Para Code Reviewers / Tech Leads

| Arquivo | Descrição |
|---------|-----------|
| [GIT_WORKFLOW.md](GIT_WORKFLOW.md) | Estratégia de branches e proteção |
| [.github/CODEOWNERS](.github/CODEOWNERS) | Quem review qual área |
| [.github/BRANCH_PROTECTION_SETUP.md](.github/BRANCH_PROTECTION_SETUP.md) | Como configurar proteção |
| [.github/pull_request_template.md](.github/pull_request_template.md) | Critérios de review |

**Responsabilidades:**
1. Configurar branch protection (vide [BRANCH_PROTECTION_SETUP.md](.github/BRANCH_PROTECTION_SETUP.md))
2. Revisar PRs seguindo template em [pull_request_template.md](.github/pull_request_template.md)
3. Garantir commits seguem [Convenção de Commits](GIT_WORKFLOW.md#convenção-de-commits)

---

### Para DevOps / SRE (Deploy & Infra)

| Arquivo | Descrição |
|---------|-----------|
| [GIT_WORKFLOW.md](GIT_WORKFLOW.md) — CI/CD section | Workflows de deploy |
| [.github/workflows/ci.yml](.github/workflows/ci.yml) | Workflow de CI |
| [.github/workflows/deploy.yml](.github/workflows/deploy.yml) | Workflow de deploy |
| [.github/BRANCH_PROTECTION_SETUP.md](.github/BRANCH_PROTECTION_SETUP.md) | Status checks obrigatórios |

**Configuração inicial:**
1. Configurar secrets em GitHub (VPS_HOST, VPS_SSH_KEY, etc)
2. Habilitar branch protection com status checks obrigatórios
3. Monitorar CI/CD runs em GitHub Actions

---

## 📖 Documentação por Tópico

### Git Basics

- **Branches**: [GIT_WORKFLOW.md — Estratégia de Branches](GIT_WORKFLOW.md#estratégia-de-branches)
- **Commits**: [GIT_WORKFLOW.md — Convenção de Commits](GIT_WORKFLOW.md#convenção-de-commits)
- **Pull Requests**: [GIT_WORKFLOW.md — Pull Requests](GIT_WORKFLOW.md#pull-requests)
- **Quick Ref**: [GIT_QUICK_REFERENCE.md](GIT_QUICK_REFERENCE.md)

### Fluxos de Trabalho

- **Feature normal**: [GIT_VISUAL_GUIDE.md#fluxo-de-feature-completo](GIT_VISUAL_GUIDE.md#fluxo-de-feature-completo)
- **Hotfix (bug produção)**: [GIT_VISUAL_GUIDE.md#hotfix-bug-crítico-em-produção](GIT_VISUAL_GUIDE.md#hotfix-bug-crítico-em-produção)
- **Release (versão nova)**: [GIT_VISUAL_GUIDE.md#release-preparar-versão](GIT_VISUAL_GUIDE.md#release-preparar-versão)
- **Passo-a-passo completo**: [GIT_WORKFLOW.md#fluxo-de-trabalho](GIT_WORKFLOW.md#fluxo-de-trabalho)

### Troubleshooting

- **Sincronização**: [GIT_TROUBLESHOOTING.md#problemas-de-sincronização](GIT_TROUBLESHOOTING.md#problemas-de-sincronização)
- **Merge/Rebase**: [GIT_TROUBLESHOOTING.md#problemas-de-mergerebase](GIT_TROUBLESHOOTING.md#problemas-de-mergerebase)
- **Commits**: [GIT_TROUBLESHOOTING.md#problemas-de-commits](GIT_TROUBLESHOOTING.md#problemas-de-commits)
- **Branches**: [GIT_TROUBLESHOOTING.md#problemas-de-branch](GIT_TROUBLESHOOTING.md#problemas-de-branch)
- **Emergência**: [GIT_TROUBLESHOOTING.md#problemas-críticos](GIT_TROUBLESHOOTING.md#problemas-críticos)

### Configuração & Administração

- **Setup de Git Hooks**: [scripts/setup-git-hooks.sh](scripts/setup-git-hooks.sh)
- **Branch Protection**: [.github/BRANCH_PROTECTION_SETUP.md](.github/BRANCH_PROTECTION_SETUP.md)
- **CODEOWNERS**: [.github/CODEOWNERS](.github/CODEOWNERS)
- **CI/CD Workflows**: [.github/workflows/](\.github/workflows/)
- **PR Template**: [.github/pull_request_template.md](.github/pull_request_template.md)

---

## 🎯 Guia por Atividade

### Quero criar uma nova feature

```
1. Leia: GIT_WORKFLOW.md#fluxo-de-trabalho
2. Siga: GIT_VISUAL_GUIDE.md#fluxo-de-feature-completo
3. Se preso: GIT_TROUBLESHOOTING.md
4. Referência rápida: GIT_QUICK_REFERENCE.md
```

### Preciso revisar um PR

```
1. Entenda: GIT_WORKFLOW.md#pull-requests
2. Critérios: .github/pull_request_template.md
3. Valide: Estão commits em Conventional Commits?
4. Aprove: Clique aprovado + merge
```

### Tenho um conflito de merge

```
1. Diagnóstico: GIT_VISUAL_GUIDE.md#resolvendo-conflicts
2. Passos: GIT_TROUBLESHOOTING.md#conflito-de-merge-ao-fazer-rebase
3. Precisar help: Slack ou GitHub issue
```

### Preciso fazer hotfix urgente

```
1. Rápido: GIT_QUICK_REFERENCE.md#hotfix-bug-em-produção
2. Detalhado: GIT_VISUAL_GUIDE.md#hotfix-bug-crítico-em-produção
3. Workflow: GIT_WORKFLOW.md#branches-de-hotfix-hotfix
```

### Vou mergear release nova

```
1. Preparar: GIT_VISUAL_GUIDE.md#release-preparar-versão
2. Steps: GIT_QUICK_REFERENCE.md#release-versão-nova
3. Workflow: GIT_WORKFLOW.md#branches-de-release-release
```

### Deletei algo por acidente

```
1. NÃO PANIQUE! → GIT_TROUBLESHOOTING.md#deletei-branch-local-por-acidente
2. Usar reflog → Recuperar commit
3. Se tudo falhar → Contactar admin
```

---

## 📋 Checklist de Setup

Para novo repositório ou novo desenvolvedor:

### Configuração Inicial (30 min)

- [ ] Clonar repositório: `git clone https://github.com/Kauast/controle-os-next.git`
- [ ] Configurar user: `git config user.name "Nome"` e `git config user.email "email"`
- [ ] Instalar Git Hooks: `bash scripts/setup-git-hooks.sh`
- [ ] Instalar dependências: `npm install` + `cd backend-senior && npm install`
- [ ] Setup .env files: `cp .env.example .env.local` e editar
- [ ] Rodar localmente: `docker compose up` + `npm run dev`

### Conhecer o Workflow (2 horas)

- [ ] Ler [ONBOARDING.md](ONBOARDING.md)
- [ ] Ler [GIT_QUICK_REFERENCE.md](GIT_QUICK_REFERENCE.md)
- [ ] Estudar [GIT_VISUAL_GUIDE.md](GIT_VISUAL_GUIDE.md)
- [ ] Salvar [GIT_TROUBLESHOOTING.md](GIT_TROUBLESHOOTING.md) como bookmark

### Primeira Feature (4-8 horas)

- [ ] Criar feature branch: `git checkout -b feature/seu-nome`
- [ ] Fazer mudança simples
- [ ] Commitar: `git commit -m "feat(escopo): descricao"`
- [ ] Push: `git push -u origin feature/seu-nome`
- [ ] Abrir PR no GitHub
- [ ] Solicitar review de dev sênior
- [ ] Responder comments e fazer merge

### Consolidar Conhecimento (1 semana)

- [ ] Fazer 3-5 features
- [ ] Resolver 1-2 conflicts
- [ ] Revisar PR de outro dev
- [ ] Ler [GIT_WORKFLOW.md](GIT_WORKFLOW.md) completamente

---

## 🔍 Busca Rápida

### Por Tópico

| Tópico | Link |
|--------|------|
| Configurar branch protection | [BRANCH_PROTECTION_SETUP.md](.github/BRANCH_PROTECTION_SETUP.md) |
| Conventional Commits | [GIT_WORKFLOW.md#convenção-de-commits](GIT_WORKFLOW.md#convenção-de-commits) |
| Merge vs Rebase | [GIT_WORKFLOW.md#merge-management](GIT_WORKFLOW.md#merge-management) |
| Git Hooks | [scripts/setup-git-hooks.sh](scripts/setup-git-hooks.sh) |
| CI/CD | [.github/workflows/ci.yml](.github/workflows/ci.yml) |
| Status Checks | [GIT_QUICK_REFERENCE.md#status-checks-o-que-significa-cada-um](GIT_QUICK_REFERENCE.md#status-checks-o-que-significa-cada-um) |

### Por Erro

| Erro | Solução |
|------|---------|
| "branch is behind" | [GIT_TROUBLESHOOTING.md — Your branch is behind](GIT_TROUBLESHOOTING.md#your-branch-is-behind-origindevelop) |
| Conflito merge | [GIT_TROUBLESHOOTING.md — Conflito de merge](GIT_TROUBLESHOOTING.md#conflito-de-merge-ao-fazer-rebase) |
| Permission denied | [GIT_TROUBLESHOOTING.md — Permission denied](GIT_TROUBLESHOOTING.md#fatal-the-current-branch-has-no-upstream-branch) |
| Deletei branch | [GIT_TROUBLESHOOTING.md — Deletei branch local](GIT_TROUBLESHOOTING.md#deletei-branch-local-por-acidente) |

---

## 🛠️ Arquivos de Configuração

### Criados Automaticamente

```
.githooks/
  ├── commit-msg          (valida formato de mensagem)
  ├── pre-commit          (valida lint/types antes de commit)
  └── pre-push            (previne push direto em main/develop)

.github/
  ├── workflows/
  │   ├── ci.yml          (testa toda PR)
  │   └── deploy.yml      (deploy automático em main)
  ├── CODEOWNERS          (auto-request de review)
  ├── BRANCH_PROTECTION_SETUP.md
  └── pull_request_template.md

scripts/
  └── setup-git-hooks.sh  (instala git hooks)

Documentação:
  ├── GIT_WORKFLOW.md             (completo, estratégia)
  ├── GIT_VISUAL_GUIDE.md         (diagramas)
  ├── GIT_TROUBLESHOOTING.md      (soluções)
  ├── GIT_QUICK_REFERENCE.md      (atalhos)
  ├── ONBOARDING.md               (novo dev)
  └── GIT_INDEX.md                (este arquivo)
```

---

## 📞 Suporte & Comunidade

### Precisa de Ajuda?

1. **Dúvida sobre Git**: Consultar [GIT_TROUBLESHOOTING.md](GIT_TROUBLESHOOTING.md)
2. **Fluxo de trabalho**: Ler [GIT_WORKFLOW.md](GIT_WORKFLOW.md)
3. **Problema específico**: Buscar em [GIT_TROUBLESHOOTING.md](GIT_TROUBLESHOOTING.md) → Ctrl+F
4. **Ainda preso?**: 
   - Abrir issue em GitHub com tag `git-workflow`
   - Perguntar no Slack #dev-team
   - Email: seu-lead@empresa.com

---

## 🎓 Recursos de Aprendizado

### Dentro do Projeto

- [ONBOARDING.md](ONBOARDING.md) — Para iniciantes
- [GIT_VISUAL_GUIDE.md](GIT_VISUAL_GUIDE.md) — Aprender visualmente
- [GIT_TROUBLESHOOTING.md](GIT_TROUBLESHOOTING.md) — Aprender resolvendo problemas

### Externos

- [Official Git Documentation](https://git-scm.com/doc)
- [GitHub Skills](https://skills.github.com)
- [Atlassian Git Tutorials](https://www.atlassian.com/git/tutorials)
- [Pro Git Book](https://git-scm.com/book/en/v2) — Gratuito online

---

## 📊 Estatísticas do Projeto

```
Repository: https://github.com/Kauast/controle-os-next
Stack: Next.js + Fastify + PostgreSQL + React Native (Capacitor)

Branch Strategy: Git Flow
Main Branch: main (produção)
Dev Branch: develop (desenvolvimento)
Feature Pattern: feature/*

CI/CD: GitHub Actions
Protected Branches: main, develop
Status Checks: 6
Review Required: 1 approval

Git Hooks: 3 (commit-msg, pre-commit, pre-push)
Conventional Commits: Sim
Signed Commits: Opcional
```

---

## 📅 Roadmap de Melhorias

Próximas melhorias planejadas:

- [ ] Adicionar exemplos de video (YouTube)
- [ ] Integração com Semantic Release (auto-versioning)
- [ ] Configurar dependabot para atualizações automáticas
- [ ] Template de issue para bugs/features
- [ ] Discussões de RFC (Request for Comments)
- [ ] Documentação em outras idiomas
- [ ] Automated changelog generation

---

## 📝 Changelog

### Versão 1.0 (2025-06-13)

- ✅ Documentação inicial completa
- ✅ Git Hooks configurados
- ✅ CI/CD workflow melhorado
- ✅ Branch Protection setup
- ✅ Pull Request template
- ✅ CODEOWNERS configurado

---

## 🔐 Segurança & Compliance

Boas práticas implementadas:

- ✅ Proteção de branches `main` e `develop`
- ✅ Requer 1 code review antes de merge
- ✅ CI/CD deve passar antes de merge
- ✅ Commit signing (opcional, recomendado)
- ✅ Verificação de .env sensíveis em CI
- ✅ Audit log de pushes em main
- ✅ Delete push disabled em branches protegidas

---

## 🚀 Próximos Passos

**Para administrador do repositório:**

1. Executar [.github/BRANCH_PROTECTION_SETUP.md](.github/BRANCH_PROTECTION_SETUP.md)
2. Adicionar team members a [.github/CODEOWNERS](.github/CODEOWNERS)
3. Configurar secrets em GitHub Settings
4. Testar CI/CD com PR de teste

**Para novos desenvolvedores:**

1. Completar [ONBOARDING.md](ONBOARDING.md)
2. Consultar [GIT_QUICK_REFERENCE.md](GIT_QUICK_REFERENCE.md)
3. Fazer primeira feature
4. Pedir review a dev sênior

---

**Última atualização**: 2025-06-13  
**Versão**: 1.0  
**Status**: ✅ Pronto para Produção  
**Manutentor**: Tim de Desenvolvimento

---

*Este índice é seu mapa de navegação. Navegue pelos arquivos conforme necessário. Boa sorte! 🚀*
