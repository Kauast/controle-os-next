# Controle OS - Sistema de Gestão de Ordens de Serviço

**Controle OS** é uma plataforma completa de gestão de Ordens de Serviço (OS) desenvolvida com tecnologias modernas, oferecendo web desktop para administradores e app mobile para técnicos de campo.

## Visão Geral

O sistema é composto por três aplicações principais:

- **Frontend Web**: Interface de gerenciamento para gestores e administradores (Next.js 15)
- **Backend API**: Server Fastify 5 com PostgreSQL e Redis para processamento e armazenamento
- **App Mobile**: Aplicativo Android via Capacitor 8 para técnicos executarem OS em campo

O sistema segue arquitetura **multi-tenant**, permitindo que múltiplas empresas operem de forma isolada.

## Stack Tecnológico

### Frontend (Web)
- **Next.js 15** - Framework React com SSR
- **TypeScript** - Tipagem de código
- **TailwindCSS 4** - Estilização
- **React Query** - Gerenciamento de estado assíncrono
- **Zustand** - State management
- **Framer Motion** - Animações

### Backend
- **Fastify 5** - Framework web rápido
- **Prisma 6** - ORM para banco de dados
- **PostgreSQL** - Banco de dados principal
- **Redis** - Cache e fila de jobs
- **BullMQ** - Processamento de jobs assíncrono
- **JWT** - Autenticação
- **Claude AI (Anthropic)** - Triagem automática de OS

### Mobile
- **Capacitor 8** - Framework para apps nativos
- **React 19** - UI mobile
- **Camera** - Captura de fotos
- **Geolocation** - Localização GPS
- **Network** - Detectar status online/offline
- **Offline Queue** - Sincronização automática

## Funcionalidades Principais

### Para Gestores/Administradores (Web)
- **Dashboard**: Métricas, agenda e fila de OS
- **Ordens de Serviço**: Criar, editar, rastrear e acompanhar OS
- **Agenda**: Agendamento de serviços
- **Estoque**: Gerenciamento de produtos e movimentações
- **Clientes**: Cadastro e gestão de clientes
- **Equipes**: Organização de técnicos em equipes
- **Usuários**: Gerenciamento de perfis e permissões
- **Chips SIM**: Controle de chips de comunicação
- **Rastreamento**: Localização em tempo real de técnicos
- **Financeiro**: Faturamento e pagamentos
- **Relatórios**: Análises de performance
- **Auditoria**: Log de todas as ações do sistema

### Para Técnicos (App Mobile)
- **Minhas OS**: Lista de ordens atribuídas
- **Check-in/Check-out**: Registro de geolocalização ao iniciar/finalizar
- **Fotos**: Captura de 3 fotos (antes, durante, depois)
- **Assinatura**: Coleta de assinatura do cliente
- **Chip SIM**: Registro do ID do chip instalado
- **Offline**: Funciona sem conexão, sincroniza automaticamente
- **Status de Rede**: Indicador visual de conexão
- **Sincronização**: Fila de ações pendentes

## Como Rodar Localmente

### Pré-requisitos
- **Node.js** 18+ e npm
- **PostgreSQL** 14+
- **Redis** 6+
- Android SDK (para build APK)

### 1. Clonar e Instalar Dependências

```bash
git clone https://github.com/Kauast/controle-os-next.git
cd controle-os-next

# Frontend
npm install

# Backend
cd backend-senior
npm install
cd ..
```

### 2. Configurar Banco de Dados

```bash
# Criar banco de dados PostgreSQL
createdb controle_os

# Criar arquivo .env no backend
cd backend-senior
cp .env.example .env
# Edite .env com credenciais do PostgreSQL
nano .env

# Executar migrações
npm run migrate:dev

# (Opcional) Popular com dados iniciais
npm run seed

cd ..
```

### 3. Configurar Variáveis de Ambiente

#### Frontend (.env.local)
```bash
cp .env.example .env.local
# Edite conforme necessário - geralmente não precisa em desenvolvimento
```

#### Mobile (.env.mobile)
```bash
cp .env.mobile.example .env.mobile
# Ajuste NEXT_PUBLIC_FASTIFY_URL com IP local do backend
# Exemplo: http://192.168.1.100:3333
```

### 4. Iniciar Servidor Backend

```bash
cd backend-senior
npm run dev
# Será executado em http://localhost:3333
```

### 5. Iniciar Frontend em Outro Terminal

```bash
npm run dev
# Será executado em http://localhost:3000
```

### 6. Acessar Aplicação

- **Web**: http://localhost:3000
- **API**: http://localhost:3333

#### Usuários de teste (após seed):
- Email: `admin@controle.com` | Função: Administrador
- Email: `tecnico@controle.com` | Função: Técnico
- Email: `estoque@controle.com` | Função: Estoque
- Email: `atendimento@controle.com` | Função: Atendimento
- Email: `financeiro@controle.com` | Função: Financeiro

As senhas são definidas em `SEED_*_PASS` no `.env` do backend.

## Scripts Disponíveis

### Frontend
```bash
npm run dev           # Iniciar em desenvolvimento
npm run build         # Build para produção
npm run start         # Rodar build de produção
npm run lint          # Verificar código
npm run type-check    # Verificar tipos TypeScript
npm run build:mobile  # Build mobile bundle
npm run cap:sync      # Sincronizar com Capacitor
npm run apk:debug     # Compilar APK debug
npm run apk:release   # Compilar APK release
```

### Backend
```bash
npm run dev               # Iniciar com hot reload
npm run build             # Compilar TypeScript
npm run start             # Rodar aplicação
npm run migrate:dev       # Criar migração e aplicar
npm run migrate:deploy    # Aplicar migrações em produção
npm run studio            # Abrir Prisma Studio (GUI do banco)
npm run seed              # Popular banco com dados iniciais
npm run test              # Executar testes
npm run test:coverage     # Cobertura de testes
```

## Estrutura de Pastas

```
controle-os-next/
├── src/
│   ├── app/               # Rotas Next.js (web, mobile, login, etc)
│   ├── components/        # Componentes React reutilizáveis
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utilitários e helpers
│   │   ├── api/           # Clientes HTTP (axios)
│   │   ├── mobile/        # Funções Capacitor (câmera, geo, rede)
│   │   └── access.ts      # Controle de permissões por role
│   ├── modules/           # Módulos de negócio (service-order, etc)
│   └── store/             # Zustand stores (auth, UI, etc)
│
├── backend-senior/
│   ├── src/
│   │   ├── server.ts      # Entry point
│   │   ├── app.ts         # Configuração do Fastify
│   │   ├── routes/        # Endpoints da API
│   │   ├── modules/       # Lógica de negócio
│   │   ├── lib/           # Utilitários
│   │   │   ├── prisma.ts  # Cliente Prisma
│   │   │   ├── cache.ts   # Redis
│   │   │   ├── config.ts  # Variáveis de ambiente
│   │   │   └── logger.ts  # Logging
│   │   └── middleware/    # Autenticação, CORS, rate limit
│   ├── prisma/
│   │   ├── schema.prisma  # Definição do banco de dados
│   │   └── migrations/    # Histórico de mudanças no banco
│   └── .env.example       # Exemplo de variáveis
│
└── docs/                  # Documentação
    ├── GUIA_GESTOR.md     # Como usar a interface web
    ├── GUIA_TECNICO.md    # Como usar o app mobile
    └── INSTALACAO.md      # Deploy e instalação
```

## Variáveis de Ambiente Importantes

### Frontend (.env.local)
```
NEXT_PUBLIC_FASTIFY_URL=http://localhost:3333
JWT_SECRET=sua-chave-secreta
```

### Backend (.env)
```
DATABASE_URL=postgresql://user:pass@localhost:5432/controle_os
REDIS_URL=redis://:password@localhost:6379
JWT_SECRET=sua-chave-secreta
PORT=3333
```

### Mobile (.env.mobile)
```
NEXT_PUBLIC_FASTIFY_URL=http://192.168.1.100:3333  # IP local
```

Para detalhes completos, veja `docs/INSTALACAO.md`.

## Modelos de Dados Principais

### ServiceOrder (Ordem de Serviço)
- ID, número sequencial, cliente, técnico
- Status: OPEN, IN_PROGRESS, WAITING_PARTS, COMPLETED, CANCELLED
- Prioridade: NORMAL, WARNING, HIGH, CRITICAL
- Datas: abertura, vencimento, início, conclusão
- Descrição e notas internas
- Itens (produtos/serviços) e valor total

### ServiceOrderExecution (Execução da OS)
- Check-in/Check-out com geolocalização
- Fotos (até 3)
- Assinatura do cliente
- Notas de trabalho realizado
- Chip SIM instalado

### Technician (Técnico)
- Associado a um usuário
- Status: AVAILABLE, BUSY, OFF, VACATION
- Especialidade
- Máximo de OS simultâneas
- Equipes que participa

### Client (Cliente)
- Dados completos (nome, documento, telefone, email, endereço)
- Pode estar bloqueado com motivo
- Histórico de OS

### Product (Produto)
- SKU único
- Preço de custo e venda
- Estoque e movimentações
- Categoria

### Invoice & Payment (Financeiro)
- Faturamento de OS
- Registro de pagamentos
- Múltiplas parcelas
- Descontos, juros, multa

## Segurança

- **Autenticação**: JWT com refresh tokens
- **Autorização**: RBAC (Role-Based Access Control)
- **Encriptação**: Senhas com bcryptjs
- **Rate Limiting**: Proteção contra brute force
- **CORS**: Configurado por domínio
- **SQL Injection**: Prisma previne via prepared statements
- **XSS**: Next.js com sanitização automática
- **Audit Log**: Todas as ações registradas

## Implantação em Produção

Veja o guia completo em `docs/INSTALACAO.md` para:
- Configuração de VPS
- Instalação com Docker Compose
- SSL/HTTPS automático (Certbot)
- Backup e disaster recovery
- Monitoramento e logs
- Performance tuning

## Documentação Adicional

- **[docs/GUIA_GESTOR.md](docs/GUIA_GESTOR.md)** - Manual completo para administradores e gestores
- **[docs/GUIA_TECNICO.md](docs/GUIA_TECNICO.md)** - Tutorial para técnicos no app mobile
- **[docs/INSTALACAO.md](docs/INSTALACAO.md)** - Guia de deployment e configuração técnica

## Contribuindo

Este é um projeto privado. Para contribuições, entre em contato com o time de desenvolvimento.

## Suporte

Em caso de dúvidas ou problemas:
1. Consulte a documentação em `docs/`
2. Verifique os logs (backend: stdout, frontend: console do navegador)
3. Abra uma issue no repositório

## Licença

ISC - Veja LICENSE

## Autor

**Kauã Miranda** - Desenvolvedor Full Stack

---

Última atualização: June 2026
