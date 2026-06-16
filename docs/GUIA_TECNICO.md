# Guia do Técnico - Controle OS

**Bem-vindo ao app Controle OS!** Este guia é para técnicos de campo que usam o aplicativo mobile (Android) para executar Ordens de Serviço (OS).

## Índice

1. [Instalação do App](#instalação-do-app)
2. [Login](#login)
3. [Interface Principal](#interface-principal)
4. [Minhas OS](#minhas-os)
5. [Executar OS](#executar-os)
6. [Finalizando a OS](#finalizando-a-os)
7. [Modo Offline](#modo-offline)
8. [Funcionalidades](#funcionalidades)
9. [FAQ](#faq)

---

## Instalação do App

### Opção 1: Instalação via APK (Android)

Seu gestor fornecerá o arquivo APK (tecnico-mobile.apk).

#### Passos:

1. **Baixe o APK** para seu celular Android
2. Abra o **Gerenciador de Arquivos**
3. Localize o arquivo `tecnico-mobile.apk`
4. Toque nele para instalar
5. Se avisar sobre "Fonte desconhecida", autorize em **Configurações**
6. Aguarde a instalação completar
7. Toque em **Abrir** ou encontre o app na tela inicial

### Opção 2: Acesso via PWA (Navegador)

Se seu gestor disponibilizar:

1. Abra o navegador no Android
2. Acesse a URL: `https://app.controle-os.com.br/tecnico`
3. Selecione **Instalar App** (se aparecer uma notificação)
4. O app será adicionado à tela inicial

### Pré-requisitos

- **Android 8.0** ou superior
- **Conexão com internet** (Wi-Fi ou dados móveis)
- **GPS habilitado** (necessário para check-in)
- **Câmera** funcionando

---

## Login

### Primeira Vez

1. Abra o app Controle OS
2. Digite seu **email** (fornecido pelo gestor)
3. Digite sua **senha**
4. Toque em **Entrar**

### Salvar Login (Opcional)

Após login, o app salva seu token automaticamente. Próximas vezes você entra direto sem digitar dados.

### Logout

1. Toque no botão **Sair** (ícone de porta) no canto superior direito
2. Você será desconectado e retornará à tela de login

---

## Interface Principal

Após fazer login, você vê a tela **Minhas OS**.

### Componentes da Tela

#### 1. Header (Topo)
- **Seu nome** e email
- **Status de rede**: Bolinha verde = Online, Vermelha = Offline
- **Contador de sincronização**: Número de ações pendentes se estiver offline
- **Botão Sair**: Logout

#### 2. Status Bar
- **"Sem conexão"**: Aparece em vermelho se você ficar offline
- Avisa que ações são salvas e sincronizarão quando voltar online

#### 3. Cards de Estatísticas
Mostram:
- **OS hoje**: Total de OS atribuídas para hoje
- **Pendentes**: OS não concluídas
- **Concluídas**: OS que você finalizou hoje
- **Status**: Online/Offline

#### 4. Lista de OS
Todas as OS atribuídas a você com:
- Status da OS
- Número da OS
- Nome do cliente
- Descrição do trabalho
- Prioridade (NORMAL, ATENÇÃO, ALTA, CRÍTICA)

---

## Minhas OS

### Visualizar Minha Lista

1. A lista aparece assim que você faz login
2. Clique em qualquer OS para abrir os detalhes
3. Use **Atualizar** (seta circular) para recarregar a lista

### Status das OS

- **Aberta**: OS criada, ainda não iniciada
- **Em andamento**: Você já fez check-in
- **Aguardando peças**: Parada até chegar material
- **Concluída**: Finalizada com sucesso
- **Cancelada**: Não será executada

### Prioridades

- **Normal** (azul): Prazo normal
- **Atenção** (laranja): Vai vencer em breve
- **Alta** (vermelho): Vence hoje
- **Crítica** (vermelho intenso): Vencida

### Selecionar OS para Executar

A primeira OS **não finalizada** é selecionada automaticamente. Você pode:

1. Clicar em outra OS para mudar qual está ativa
2. A OS ativa fica destacada em **âmbar**
3. Todas as ações (fotos, assinatura, etc) são para a OS ativa

---

## Executar OS

### Passo 1: Visualizar Detalhes do Cliente

Ao abrir a OS ativa, você vê:
- **Nome do cliente**
- **Endereço completo**
- **Telefone** (toque para ligar)
- **Rota** (toque para abrir Google Maps com o endereço)
- **Status da OS**
- **Descrição do trabalho**

### Passo 2: Fazer Check-in

Antes de iniciar o trabalho:

1. Toque em **"Iniciar atendimento"**
2. O app solicita permissão de GPS
3. O app captura sua localização geográfica
4. Registra data e hora do check-in
5. Botão muda para **"✓ Check-in realizado"**

**O que é capturado:**
- Data e hora exata
- Latitude e longitude (GPS)
- Localização textual (baseada em GPS)

Seu gestor pode verificar depois que você esteve mesmo no local.

### Passo 3: Capturar Fotos

Você precisa capturar **3 fotos** obrigatoriamente:

1. **ANTES**: Situação inicial do equipamento/ambiente
2. **DURANTE**: Você executando o trabalho
3. **DEPOIS**: Resultado final do trabalho

#### Como tirar foto:

1. Toque na caixa de foto ("Antes", "Durante" ou "Depois")
2. Escolha **Câmera** para tirar nova foto OU **Galeria** para usar foto anterior
3. Tire a foto (ou selecione da galeria)
4. Confirme
5. Foto aparece na caixa (thumbnail)
6. ✓ Verde indica upload bem-sucedido

#### Substituir Foto

Se tirou foto errada:
1. Toque na caixa de foto novamente
2. Tire outra foto
3. A anterior será substituída

### Passo 4: Registrar Chip SIM

Se você instalou um chip de comunicação:

1. Digite ou copie o **ICCID** (número do chip, ~20 dígitos)
2. Está geralmente na costas do chip
3. Você pode digitar parcialmente (ex: apenas "89550400")
4. Toque em **"Confirmar chip"**
5. Número fica verde quando confirmado

Se não há chip para instalar, deixe em branco.

### Passo 5: Coletar Assinatura

O cliente precisa assinar confirmando que o trabalho foi feito:

1. **Toque na área de assinatura** (tela em branco)
2. O cliente assina com o dedo
3. Clique em **"Confirmar"** para salvar
4. Ou **"Limpar"** para apagar e pedir nova assinatura

**Dica**: Peça ao cliente para assinar de forma legível. Essa assinatura é a prova legal que o serviço foi feito.

### Passo 6: Checklist de Conclusão

Antes de finalizarr, você precisa completar:

- ✓ **Check-in**: Localização registrada
- ✓ **3 fotos**: Antes, durante, depois
- ✓ **Assinatura**: Cliente assinou
- ✓ **ID do chip**: Preenchido (se aplicável)

Um card no topo mostra o progresso. Quando todos estão ✓, o status muda de **"Pendente"** para **"Liberado"**.

---

## Finalizando a OS

Quando tudo está completo:

1. O botão **"Finalizar OS"** fica habilitado
2. Toque nele
3. O app faz novo **check-out** (registro de saída):
   - Captura localização final
   - Registra data/hora de saída
4. A OS aparece com status **"Concluída ✓"**

Parabéns! A OS foi finalizada com sucesso.

#### O que acontece depois:

- O gestor recebe notificação que você finalizou
- Ele pode ver fotos, assinatura e chips
- Se configurado, a OS é automaticamente faturada
- A próxima OS fica selecionada para você executar

---

## Modo Offline

O app funciona **completamente offline**. Você pode tirar fotos, fazer check-in, coletar assinatura sem conexão.

### Como Funciona

#### Quando está Offline:
- **Ícone de rede**: Fica vermelho (WifiOff)
- Banner avisa: **"Sem conexão — ações ficam salvas e sincronizam automaticamente"**
- Você pode continuar trabalhando normalmente
- Tudo é armazenado no celular

#### Quando Volta Online:
- **Ícone fica verde** (Wifi)
- Aparece um contador de ações **"Pendentes de Sincronização"**
- Clique no botão para sincronizar manualmente
- OU deixa rodar (sincroniza automaticamente em poucos segundos)
- Mensagem avisa quantas ações foram sincronizadas

### Sincronização Manual

Se você quer sincronizar agora:

1. Toque no botão com número de pendentes
2. Espere a sincronização terminar
3. Verá mensagem de sucesso ou erro
4. Se tiver erros, tente novamente quando tiver melhor conexão

### Limitações Offline

Você pode fazer:
- ✓ Tirar fotos
- ✓ Fazer check-in/check-out
- ✓ Coletar assinatura
- ✓ Registrar chip
- ✓ Ver sua lista de OS (com dados já carregados)

Você NÃO pode:
- ✗ Carregar lista atualizada de OS
- ✗ Ver detalhes de nova OS (só se já havia carregado)
- ✗ Acessar maps online

---

## Funcionalidades

### Atualizar Lista de OS

Toque no botão **Atualizar** (seta circular) para:
- Recarregar lista de OS atribuídas
- Baixar novas OS que foram criadas para você
- Ver OS canceladas ou reagendadas

**Dica**: Atualize no início do dia e quando terminar cada OS.

### Ligar para Cliente

Na tela da OS ativa:
1. Toque em **"Ligar"** (ícone de telefone)
2. Seu celular abre o discador com número
3. Toque para ligar
4. Conversa com cliente sobre endereço, acesso, etc.

### Navegar para Cliente (Maps)

1. Toque em **"Rota"** (ícone de mapa)
2. Google Maps abre mostrando o caminho até o cliente
3. Você dirige com GPS

**Dica**: Faça isso no começo do dia para planejar sua rota.

### Indicador de Sincronização Pendente

Se tiver ações que ainda não foram enviadas ao servidor:
1. Um badge com número aparece no header
2. Clique nele para sincronizar manualmente
3. Aguarde até completar
4. Se falhar, tenta novamente automaticamente

---

## FAQ

### P: Qual é o formato do ICCID do chip?

R: ICCID tem geralmente 20 dígitos começando com "8955". Procure na costas do chip físico ou no papelinho que vem com ele. Você pode digitar só parte dele.

### P: Posso tirar a foto em outro momento?

R: Sim, você pode tirar foto agora e outra depois. Use a galeria para fotos anteriores.

### P: O GPS está drenando minha bateria muito rápido.

R: É normal. O check-in e check-out usam GPS. Dica: atualize para versão mais recente do app. Nós otimizamos o uso de bateria em atualizações recentes.

### P: Esqueci de fazer check-in. Posso fazer depois?

R: Sim! Você pode fazer check-in a qualquer momento antes de finalizar a OS. Só clique em "Iniciar atendimento" novamente.

### P: Posso cancelar uma OS?

R: Não. Se houver problema, entre em contato com seu gestor. Ele pode cancelar a OS na interface web.

### P: Qual é a diferença entre "Salvar" e "Sincronizar"?

R: **Salvar** = Armazenar no celular (local). **Sincronizar** = Enviar para o servidor. O app faz ambos automaticamente.

### P: Posso fazer logout sem ter finalizaddas todas as OS?

R: Sim, mas elas continuarão atribuídas a você. Próximas vezes que fizer login, verá as mesmas OS.

### P: Quanto de dados móveis o app consome?

R: Fotos são comprimidas antes de enviar. Cada foto = ~200-500 KB. Em comparação com redes sociais, é muito pouco.

### P: Meu GPS não funciona. O que faço?

R: 1. Verifique se "Local" está ligado em Configurações
2. Deixe abrir app de Maps e espere 30 segundos para calibrar
3. Se ainda não funcionar, entre em contato com suporte

### P: Posso alterar a data/hora no check-in?

R: Não. Check-in e check-out sempre usam data/hora do seu celular (servidor não aceita valores alterados para evitar fraudes).

### P: O que faço se perdi a senha?

R: 1. Saia do app (logout)
2. Na tela de login, clique em "Esqueceu a senha?"
3. Digite seu email
4. Você receberá link para resetar
5. Crie nova senha e faça login

### P: Posso usar o app em múltiplos celulares?

R: Sim, mas com a mesma conta você só pode estar logado em um celular por vez.

### P: Minha foto é grande demais?

R: O app comprime automaticamente para ~1280 pixels. Você não precisa fazer nada.

### P: Posso vê notas do gestor sobre a OS?

R: Sim! Na tela da OS, aparece:
- **Descrição**: O que você vai fazer
- **Notas internas**: Avisos especiais do gestor

---

## Dicas Profissionais

1. **Comece o dia atualizando** a lista de OS para não perder nenhuma
2. **Tire fotos de boa qualidade** — elas podem ser usadas em litígios
3. **Peça assinatura legível** ao cliente — é prova legal
4. **Verifique sua rota** antes de sair — use o mapa para otimizar
5. **Sincronize regularmente** — não deixe muitas ações pendentes
6. **Use as notas internas** — seu gestor pode deixar dicas importantes lá
7. **Registre o chip corretamente** — evita confusão depois

---

## Requisitos do Sistema

- **Android**: 8.0 ou superior
- **RAM**: Mínimo 2 GB
- **Espaço em disco**: Mínimo 100 MB livres
- **Câmera**: Qualquer resolução (será comprimida)
- **GPS**: Recomendado (mas não obrigatório se usar geolocalização por rede)

---

## Problemas Comuns e Soluções

| Problema | Solução |
|----------|---------|
| App não abre | Reinicie o celular |
| Login não funciona | Verifique email/senha, internet, tente reset de senha |
| Fotos não salvam | Verifique permissão de câmera em Configurações |
| GPS não funciona | Ligue "Local" em Configurações, aguarde calibração |
| Sincronização lenta | Mude para Wi-Fi se estiver em dados móveis |
| Assinatura não funciona | Tente com dedo mais pressionado |
| App travou | Force fechamento: Configurações → Apps → Controle OS → Forçar Parada |

---

## Contato e Suporte

Em caso de problemas:

1. Tente as soluções acima
2. Reinicie o app
3. Reinicie o celular
4. Entre em contato com seu gestor ou suporte técnico

**Email de suporte**: [email do suporte]
**WhatsApp**: [número de suporte]
**Horário**: Segunda a sexta, 8h-18h

---

## Changelog (Atualizações Recentes)

### v1.0.0 (Atual)
- ✓ Minhas OS
- ✓ Check-in/Check-out com GPS
- ✓ Captura de fotos
- ✓ Coleta de assinatura
- ✓ Registro de chip SIM
- ✓ Modo offline com sincronização automática
- ✓ Indicador de status de rede

Futuras atualizações:
- [ ] Suporte para múltiplas fotos (mais de 3)
- [ ] Gravação de vídeo
- [ ] Chat com gestor
- [ ] Agendamento de retorno

---

**Última atualização**: June 2026

Obrigado por usar Controle OS!
