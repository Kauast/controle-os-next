// Templates HTML simples para cada tipo de evento.
// Sem dependências externas — apenas template literals.

const BASE_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  max-width: 560px;
  margin: 0 auto;
  padding: 24px;
  color: #1e293b;
`;

const BUTTON_STYLE = `
  display: inline-block;
  background: #0f172a;
  color: #ffffff;
  padding: 12px 24px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  margin: 24px 0;
`;

const FOOTER_STYLE = `color: #64748b; font-size: 13px; margin-top: 32px;`;

function wrapper(content: string): string {
  return `<div style="${BASE_STYLE}">${content}<p style="${FOOTER_STYLE}">Este e-mail foi enviado automaticamente. Nao responda.</p></div>`;
}

// ─── os.completed ─────────────────────────────────────────────────────────────
export function osCompleted(payload: {
  clientName?: string;
  osCode?: string;
  companyName?: string;
}): { subject: string; html: string } {
  const { clientName = 'Cliente', osCode = '', companyName = '' } = payload;
  return {
    subject: 'Sua Ordem de Servico foi concluida',
    html: wrapper(`
      <h2>Ordem de Servico Concluida</h2>
      <p>Ola${clientName ? ', ' + clientName : ''}!</p>
      <p>
        A sua Ordem de Servico${osCode ? ' <strong>#' + osCode + '</strong>' : ''}
        ${companyName ? 'de <strong>' + companyName + '</strong>' : ''}
        foi <strong>concluida</strong> com sucesso.
      </p>
      <p>Em caso de duvidas, entre em contato com nosso suporte.</p>
    `),
  };
}

// ─── os.assigned ──────────────────────────────────────────────────────────────
export function osAssigned(payload: {
  technicianName?: string;
  osCode?: string;
  clientName?: string;
  description?: string;
}): { subject: string; html: string } {
  const { technicianName = 'Tecnico', osCode = '', clientName = '', description = '' } = payload;
  return {
    subject: 'Nova Ordem de Servico atribuida a voce',
    html: wrapper(`
      <h2>Nova OS Atribuida</h2>
      <p>Ola${technicianName ? ', ' + technicianName : ''}!</p>
      <p>
        Uma nova Ordem de Servico${osCode ? ' <strong>#' + osCode + '</strong>' : ''} foi atribuida a voce.
      </p>
      ${clientName ? `<p><strong>Cliente:</strong> ${clientName}</p>` : ''}
      ${description ? `<p><strong>Descricao:</strong> ${description}</p>` : ''}
      <p>Acesse o sistema para visualizar os detalhes.</p>
    `),
  };
}

// ─── os.cancelled ─────────────────────────────────────────────────────────────
export function osCancelled(payload: {
  clientName?: string;
  osCode?: string;
  reason?: string;
}): { subject: string; html: string } {
  const { clientName = 'Cliente', osCode = '', reason = '' } = payload;
  return {
    subject: 'Sua Ordem de Servico foi cancelada',
    html: wrapper(`
      <h2>Ordem de Servico Cancelada</h2>
      <p>Ola${clientName ? ', ' + clientName : ''}!</p>
      <p>
        Informamos que a Ordem de Servico${osCode ? ' <strong>#' + osCode + '</strong>' : ''}
        foi <strong>cancelada</strong>.
      </p>
      ${reason ? `<p><strong>Motivo:</strong> ${reason}</p>` : ''}
      <p>Entre em contato conosco se tiver alguma duvida.</p>
    `),
  };
}

// ─── stock.below_min ──────────────────────────────────────────────────────────
export function stockBelowMin(payload: {
  adminName?: string;
  productName?: string;
  currentQty?: number;
  minQty?: number;
}): { subject: string; html: string } {
  const { adminName = 'Administrador', productName = '', currentQty, minQty } = payload;
  return {
    subject: 'Alerta: Produto abaixo do estoque minimo',
    html: wrapper(`
      <h2>Alerta de Estoque Baixo</h2>
      <p>Ola${adminName ? ', ' + adminName : ''}!</p>
      <p>
        O produto <strong>${productName}</strong> esta com o estoque abaixo do minimo configurado.
      </p>
      ${currentQty !== undefined ? `<p><strong>Quantidade atual:</strong> ${currentQty}</p>` : ''}
      ${minQty !== undefined ? `<p><strong>Estoque minimo:</strong> ${minQty}</p>` : ''}
      <p>Recomendamos realizar um pedido de reposicao o quanto antes.</p>
    `),
  };
}

// ─── invoice.overdue ──────────────────────────────────────────────────────────
export function invoiceOverdue(payload: {
  clientName?: string;
  invoiceNumber?: string;
  dueDate?: string;
  amount?: string;
}): { subject: string; html: string } {
  const { clientName = 'Cliente', invoiceNumber = '', dueDate = '', amount = '' } = payload;
  return {
    subject: 'Aviso: Fatura vencida',
    html: wrapper(`
      <h2>Fatura Vencida</h2>
      <p>Ola${clientName ? ', ' + clientName : ''}!</p>
      <p>
        Identificamos que a fatura${invoiceNumber ? ' <strong>#' + invoiceNumber + '</strong>' : ''}
        encontra-se em aberto.
      </p>
      ${dueDate ? `<p><strong>Vencimento:</strong> ${dueDate}</p>` : ''}
      ${amount  ? `<p><strong>Valor:</strong> ${amount}</p>` : ''}
      <p>Regularize o pagamento para evitar interrupcoes no servico.</p>
      <p>Em caso de duvidas, entre em contato com nossa equipe financeira.</p>
    `),
  };
}

// ─── material_request.reviewed ────────────────────────────────────────────────
export function materialRequestReviewed(payload: {
  requesterName?: string;
  requestCode?: string;
  status?: string;
  observation?: string;
}): { subject: string; html: string } {
  const { requesterName = 'Usuario', requestCode = '', status = '', observation = '' } = payload;
  return {
    subject: 'Sua requisicao de material foi revisada',
    html: wrapper(`
      <h2>Requisicao de Material Revisada</h2>
      <p>Ola${requesterName ? ', ' + requesterName : ''}!</p>
      <p>
        A sua requisicao de material${requestCode ? ' <strong>#' + requestCode + '</strong>' : ''} foi revisada.
      </p>
      ${status      ? `<p><strong>Status:</strong> ${status}</p>` : ''}
      ${observation ? `<p><strong>Observacao:</strong> ${observation}</p>` : ''}
      <p>Acesse o sistema para mais detalhes.</p>
    `),
  };
}

// ─── user.created ─────────────────────────────────────────────────────────────
export function userCreated(payload: {
  name?: string;
  email?: string;
  companyName?: string;
  loginUrl?: string;
}): { subject: string; html: string } {
  const { name = 'Usuario', email = '', companyName = 'Controle OS', loginUrl = '' } = payload;
  return {
    subject: 'Bem-vindo ao Controle OS',
    html: wrapper(`
      <h2>Bem-vindo ao ${companyName}!</h2>
      <p>Ola${name ? ', ' + name : ''}!</p>
      <p>Sua conta foi criada com sucesso no sistema <strong>${companyName}</strong>.</p>
      ${email ? `<p><strong>E-mail de acesso:</strong> ${email}</p>` : ''}
      ${loginUrl
        ? `<p><a href="${loginUrl}" style="${BUTTON_STYLE}">Acessar o sistema</a></p>`
        : '<p>Acesse o sistema para comecar a usar.</p>'
      }
      <p>Se voce nao solicitou esta conta, desconsidere este e-mail.</p>
    `),
  };
}
