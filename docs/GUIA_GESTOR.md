# Guia do Gestor - Controle OS

**Bem-vindo ao Controle OS!** Este guia é para gestores, administradores e supervisores que usam a interface web para gerenciar o sistema de Ordens de Serviço.

## Índice

1. [Login e Autenticação](#login-e-autenticação)
2. [Dashboard](#dashboard)
3. [Ordens de Serviço](#ordens-de-serviço)
4. [Agenda](#agenda)
5. [Estoque](#estoque)
6. [Clientes](#clientes)
7. [Equipes e Técnicos](#equipes-e-técnicos)
8. [Usuários](#usuários)
9. [Chips SIM](#chips-sim)
10. [Rastreamento](#rastreamento)
11. [Financeiro](#financeiro)
12. [Relatórios](#relatórios)
13. [FAQ](#faq)

---

## Login e Autenticação

### Como fazer login

1. Acesse a URL do sistema (ex: `https://app.controle-os.com.br`)
2. Você será redirecionado para a página de login
3. Digite seu **email** e **senha**
4. Clique em **Entrar**

### Esqueceu sua senha?

1. Na página de login, clique em **Esqueceu a senha?**
2. Digite seu email cadastrado
3. Você receberá um email com link de reset
4. Clique no link e crie uma nova senha
5. Faça login com a nova senha

### Logout

No menu superior direito, clique seu nome/avatar e selecione **Sair**.

---

## Dashboard

O **Dashboard** é a página inicial após login. Mostra um resumo do estado geral do sistema.

### Componentes Principais

#### 1. Métricas Rápidas
Cards no topo mostrando:
- **Total de OS hoje**: Quantidade de ordens criadas nas últimas 24h
- **OS em andamento**: Ordens em execução
- **Técnicos online**: Quantos técnicos estão com app ativo
- **Pendentes a vencer**: Ordens próximas do vencimento

#### 2. Dispatch Board (Quadro de Distribuição)
- Mostra OS não atribuídas a técnicos
- Permite atribuir rapidamente clicando em uma OS
- Filtra por prioridade e vencimento
- Recomenda técnicos com base em disponibilidade

#### 3. Agenda
- Visualiza OS agendadas para hoje e próximos dias
- Aceita drop-and-drop para reagendar
- Mostra status do técnico (disponível, ocupado, etc)

#### 4. Fila de OS
- Lista de OS recentes
- Atalhos para editar ou visualizar detalhes
- Filtros por status e cliente

---

## Ordens de Serviço

### Criar Nova OS

1. No menu lateral, clique em **Ordens de Serviço** → **Nova OS**
2. Preencha os campos obrigatórios:
   - **Cliente**: Selecione ou crie novo cliente
   - **Descrição**: O que será feito no serviço
   - **Prioridade**: NORMAL, WARNING, HIGH ou CRITICAL
   - **Data de Vencimento**: Quando deve ser concluída
3. (Opcional) Adicione itens (produtos/serviços) clicando em **Adicionar Item**
4. Clique em **Criar OS**

### Visualizar OS

1. Acesse **Ordens de Serviço** no menu
2. Procure a OS na lista ou use o filtro
3. Clique na OS para abrir seus detalhes

### Campos Importantes

- **Status**: OPEN (aberta), IN_PROGRESS (em andamento), WAITING_PARTS (aguardando peças), COMPLETED (concluída), CANCELLED (cancelada)
- **Prioridade**: Define urgência visual
- **Técnico Atribuído**: Quem vai executar
- **Data de Vencimento**: Prazo máximo
- **Descrição**: Detalhes do trabalho a fazer
- **Notas Internas**: Informações apenas para equipe interna

### Editar OS

1. Abra a OS
2. Clique no botão **Editar** (lápis)
3. Modifique os campos desejados
4. Clique em **Salvar**

### Atribuir Técnico

1. Abra a OS
2. Clique em **Atribuir Técnico**
3. Selecione o técnico desejado
4. (Opcional) Escolha uma data/hora de agendamento
5. Clique em **Confirmar**

### Rastrear Execução

Enquanto a OS está em andamento, você pode:
- Ver localização em tempo real do técnico
- Ver fotos capturadas
- Ver notas do técnico
- Enviar mensagens ao técnico

### Finalizar OS

Quando o técnico marca como concluída:
1. A OS aparece com status COMPLETED
2. Você pode visualizar fotos, assinatura e chip instalado
3. Se configurado, cria automaticamente uma fatura

### Cancelar OS

1. Abra a OS
2. Clique em **Cancelar OS**
3. Digite o motivo do cancelamento
4. Confirme

---

## Agenda

A **Agenda** oferece visão cronológica de todas as OS agendadas.

### Visualizações

- **Dia**: Mostra hora por hora
- **Semana**: Semana inteira com técnicos como colunas
- **Mês**: Visão mensal com pontos nas datas

### Operações

- **Arrastar e soltar**: Mude uma OS de data/técnico arrastando
- **Clicar na OS**: Abre detalhes para edição
- **Filtrar por técnico**: Escolha qual técnico ver
- **Visualizar disponibilidade**: Vê quem está livre

---

## Estoque

Gerencia produtos e movimentações de estoque.

### Produtos

#### Adicionar Produto

1. Clique em **Estoque** → **Produtos**
2. Clique em **Novo Produto**
3. Preencha:
   - **Nome**: Nome do produto
   - **SKU**: Código único (ex: CHIP-SIM-001)
   - **Categoria**: Escolha ou crie nova
   - **Preço de Custo**: Quanto custou para comprar
   - **Preço de Venda**: Quanto cobrar do cliente
   - **Estoque Mínimo**: Alerta quando cai abaixo disto
4. Clique em **Salvar**

#### Editar Produto

1. Procure o produto
2. Clique para abrir
3. Clique **Editar**
4. Modifique e **Salvar**

#### Localização

Você pode especificar onde o produto está armazenado (ex: "Prateleira A2" ou "Almoxarifado").

### Movimentações

Toda vez que alguém pega ou devolve produto, gera uma movimentação registrada automaticamente.

#### Tipos de Movimentação

- **IN**: Produto entra (compra, devolução)
- **OUT**: Produto sai (venda, uso em OS)
- **TRANSFER**: Move entre locais
- **ADJUSTMENT**: Ajuste (quebra, perda, etc)
- **LOSS**: Desperdício
- **RETURN**: Devolução ao fornecedor

#### Visualizar Histórico

1. Abra o produto
2. Clique em **Histórico**
3. Veja todas as movimentações com datas

### Reservas

Quando uma OS é criada com itens, os produtos são **reservados** automaticamente.

#### Liberar Reserva

Se a OS for cancelada, a reserva é liberada e o estoque fica disponível novamente.

---

## Clientes

### Adicionar Cliente

1. Clique em **Clientes** → **Novo Cliente**
2. Preencha:
   - **Nome**: Nome completo ou da empresa
   - **Documento**: CPF/CNPJ
   - **Telefone**: Contato principal
   - **Email**: Para receber comunicações
   - **Endereço**: Completo (rua, número, cidade, estado)
3. (Opcional) **Contato**: Nome da pessoa responsável
4. Clique em **Salvar**

### Bloqueio de Cliente

Se um cliente deixa de pagar:

1. Abra o cliente
2. Clique em **Bloquear Cliente**
3. Digite o motivo (ex: "Débito em aberto")
4. Confirme

Clientes bloqueados:
- Aparecem marcados em vermelho
- Novas OS não podem ser criadas para eles
- Histórico fica visível

### Desbloquear Cliente

1. Abra o cliente bloqueado
2. Clique em **Desbloquear**
3. Confirme

### Diretório de Clientes

Acesso rápido a todos os clientes com:
- Filtro por nome, cidade, documento
- Visualização de último contato
- Histórico de OS por cliente

---

## Equipes e Técnicos

### Criar Equipe

1. Clique em **Equipes** → **Nova Equipe**
2. Digite o **Nome da Equipe** (ex: "Equipe Sul")
3. Clique em **Criar**

### Adicionar Técnico à Equipe

1. Abra a equipe
2. Clique em **Adicionar Membro**
3. Selecione o técnico
4. (Opcional) Marque **É Líder** para que ele gerencie a equipe
5. Clique em **Confirmar**

### Remover Técnico de Equipe

1. Abra a equipe
2. Clique no ícone **X** ao lado do técnico
3. Confirme

### Cadastrar Técnico

1. Clique em **Usuários** (ver próxima seção)
2. Crie um usuário com função **TECHNICIAN**
3. O técnico aparecerá na lista de técnicos disponíveis

---

## Usuários

### Criar Usuário

1. Clique em **Usuários** → **Novo Usuário**
2. Preencha:
   - **Nome**: Nome completo
   - **Email**: Email único
   - **Função**: Admin, Supervisor, Estoque, Técnico, Atendimento ou Financeiro
3. (Opcional) A senha inicial é gerada automaticamente e enviada por email
4. Clique em **Criar**

### Funções e Permissões

| Função | Permissões |
|--------|-----------|
| **ADMIN** | Acesso completo a tudo |
| **SUPERVISOR** | Cria/edita OS, gerencia técnicos, relatórios |
| **STOCK** | Gerencia estoque, movimentações, reservas |
| **TECHNICIAN** | Vê e executa suas OS via app mobile |
| **ATTENDANT** | Cria OS, gerencia clientes |
| **FINANCIAL** | Acesso ao módulo financeiro (faturas, pagamentos) |

### Editar Usuário

1. Procure o usuário
2. Clique para abrir
3. Clique **Editar**
4. Modifique função, nome, etc
5. Clique **Salvar**

### Resetar Senha

1. Abra o usuário
2. Clique em **Resetar Senha**
3. Um novo link de reset será enviado por email

### Desativar Usuário

1. Abra o usuário
2. Clique em **Desativar**
3. Confirme

Usuários desativados não podem fazer login.

---

## Chips SIM

Controle de chips de comunicação instalados nos equipamentos do cliente.

### Adicionar Chip

1. Clique em **Chips** → **Novo Chip**
2. Preencha:
   - **ICCID**: Código do chip (números na parte de trás do chip)
   - **Número de Telefone**: (opcional)
   - **Operadora**: Vivo, Claro, Oi, TIM, etc
   - **Modelo**: (opcional, ex: "Micro SIM")
3. Clique em **Criar**

### Associar Chip a Cliente

1. Abra o chip
2. Clique em **Atribuir a Cliente**
3. Selecione o cliente
4. Clique em **Confirmar**

O chip agora está instalado no equipamento desse cliente.

### Instalar Chip em OS

1. Quando o técnico vai instalar um chip, cria uma OS
2. A OS é atribuída ao técnico
3. O técnico registra o ID do chip no app mobile
4. Ao finalizar, o chip fica associado àquela OS

### Histórico de Chips

1. Abra o chip
2. Clique em **Histórico**
3. Veja todos os clientes que tiveram esse chip

---

## Rastreamento

Acompanhe técnicos em tempo real enquanto executam OS.

### Ver Localização

1. Clique em **Rastreamento**
2. Verá um mapa com marcadores dos técnicos online
3. Clique em um técnico para ver detalhes:
   - Última atualização
   - OS em execução
   - Foto de perfil

### Histórico de Localização

1. Abra a OS finalizada
2. Clique em **Detalhes da Execução**
3. Veja a geolocalização do check-in e check-out
4. Confirma que técnico esteve no local

### Privacidade

- Localização é registrada apenas durante check-in e check-out
- Dados estão armazenados com a OS (auditável)
- Histórico pode ser apagado após período de retenção conforme política da empresa

---

## Financeiro

Gerencia faturas, pagamentos e fluxo de caixa.

### Faturar OS Concluída

1. Abra a OS concluída
2. Clique em **Gerar Fatura**
3. Revise os itens e valores
4. Clique em **Criar Fatura**

A fatura é gerada automaticamente com status **DRAFT** (rascunho).

### Emitir Fatura

1. Abra a fatura em status DRAFT
2. Revise dados e valores
3. Clique em **Emitir**
4. Status muda para **ISSUED** (emitida)

### Registrar Pagamento

1. Abra a fatura
2. Clique em **Registrar Pagamento**
3. Preencha:
   - **Valor**: Quanto foi pago
   - **Método**: Dinheiro, PIX, Cartão, TED, Boleto, Cheque
   - **Data**: Quando foi pago
   - **Descontos/Juros**: (opcional)
4. Clique em **Confirmar**

#### Pagamentos Parciais

Se o cliente paga parte:
1. Crie pagamento com valor menor
2. Fatura muda para status **PARTIAL**
3. Crie outro pagamento para o saldo
4. Quando todo quitado, status vira **PAID**

### Parcelamento

Ao registrar pagamento, você pode:
- Dividir em múltiplas parcelas
- Definir datas para cada parcela
- Sistema acompanha automaticamente

---

## Relatórios

Análises do desempenho do negócio.

### Tipos de Relatórios

#### 1. OS por Período
- Quantas OS foram criadas/concluídas
- Tempo médio de execução
- Filtra por técnico, cliente, período

#### 2. Performance de Técnicos
- Quantas OS cada técnico fez
- Índice de satisfação (se avaliação estiver ativa)
- Especialidade vs. execução

#### 3. Financeiro
- Receita total por período
- Margem de lucro
- Clientes que mais gastam
- Pendências a receber

#### 4. Estoque
- Produtos mais usados
- Produtos abaixo do mínimo
- Custo do estoque

#### 5. Clientes
- Clientes mais ativos
- Frequência de serviços
- Histórico de gastos

### Exportar Relatório

1. Abra o relatório desejado
2. Clique em **Exportar**
3. Escolha formato:
   - **PDF**: Para imprimir
   - **CSV**: Para Excel/Planilha
4. Clique em **Download**

---

## FAQ

### P: Como agendar uma OS?

R: Ao criar a OS ou depois de atribuir a um técnico, clique em **Agendar** e escolha data/hora. O técnico verá no app.

### P: Posso editar uma OS após atribuição?

R: Sim, mas se o técnico já começou a executar, algumas informações podem estar bloqueadas (como cliente e itens).

### P: O que acontece se o técnico ficar offline?

R: As ações dele são salvas localmente no app. Quando voltar online, sincroniza automaticamente. Você pode acompanhar no contador "Pendente de Sincronização".

### P: Como bloquear um cliente inadimplente?

R: Abra o cliente → **Bloquear Cliente** → digite motivo. Ele não poderá receber novas OS enquanto bloqueado.

### P: Posso deletar uma OS?

R: Não. Ao invés disso, **Cancele** a OS informando o motivo. Assim mantém histórico para auditoria.

### P: Onde vejo os logs de todas as ações?

R: Clique em **Auditoria** (no menu, se tiver acesso). Mostra quem fez o quê e quando.

### P: Como integrar com SMS ou email automático?

R: Configure as notificações em **Configurações** → **Integrações**. Você pode avisar cliente quando OS é criada, concluída, etc.

### P: Posso imprimir uma OS?

R: Sim. Abra a OS e clique em **Imprimir** (ou use Ctrl+P no navegador).

### P: Como exportar dados para fazer análises?

R: Use a seção **Relatórios**. Todos os relatórios podem ser exportados em CSV (compatível com Excel).

### P: Qual é a diferença entre "Notas Internas" e "Descrição"?

R: **Descrição** é o que você informa ao cliente sobre o trabalho. **Notas Internas** são só para você e sua equipe.

### P: Posso usar o sistema em tablet?

R: Sim! A interface web funciona em qualquer navegador (desktop, tablet). O app mobile é só para Android (técnicos).

---

## Dicas de Uso

1. **Filtros**: Use os filtros para encontrar rapidamente o que precisa
2. **Atalhos do Teclado**: Pressione `?` em qualquer página para ver atalhos
3. **Busca Rápida**: Clique na barra de busca (topo) para encontrar OS, clientes, técnicos
4. **Notificações**: Configure em **Configurações** para receber alertas de OS urgentes
5. **Auto-Save**: Muitos campos salvam automaticamente, mas clique o botão **Salvar** para ter certeza

---

## Suporte

Em caso de dúvidas ou problemas:

- Consulte a seção **FAQ** acima
- Entre em contato com o suporte técnico
- Verifique os logs de erro (seu navegador → F12 → Console)

**Última atualização**: June 2026
