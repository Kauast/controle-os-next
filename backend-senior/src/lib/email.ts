import nodemailer from 'nodemailer';

function getTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });
}

export async function sendEmail(to: string, subject: string, html: string) {
  const transport = getTransport();
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@sistema.com';
  if (!transport) {
    console.log(`[EMAIL] Para: ${to} | Assunto: ${subject}`);
    console.log(`[EMAIL] ${html.replace(/<[^>]+>/g, '').slice(0, 200)}`);
    return;
  }
  await transport.sendMail({ from, to, subject, html });
}

export function buildPasswordResetEmail(name: string, resetUrl: string, domain: string) {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#0f172a">Redefinicao de senha</h2>
      <p>Ola${name ? ', ' + name : ''}!</p>
      <p>Recebemos uma solicitacao para redefinir a senha da sua conta em <strong>${domain}</strong>.</p>
      <p>Clique no botao abaixo. O link expira em <strong>30 minutos</strong>.</p>
      <p style="margin:32px 0">
        <a href="${resetUrl}"
           style="background:#0f172a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Redefinir minha senha
        </a>
      </p>
      <p style="color:#64748b;font-size:13px">
        Se voce nao solicitou, ignore este e-mail.<br>
        Link: ${resetUrl}
      </p>
    </div>
  `;
}
