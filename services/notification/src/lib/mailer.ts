import nodemailer from 'nodemailer';
import { env } from '../env';
import { logger } from './logger';

function getTransport() {
  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) return null;
  return nodemailer.createTransport({
    host:   env.smtpHost,
    port:   env.smtpPort,
    secure: env.smtpSecure,
    auth: { user: env.smtpUser, pass: env.smtpPass },
  });
}

export interface SendEmailOptions {
  to:      string;
  subject: string;
  html:    string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<void> {
  const transport = getTransport();

  if (!transport) {
    // Modo dev: apenas loga sem SMTP configurado
    logger.info(
      { event: 'email_dev_mode', to, subject },
      'SMTP nao configurado — e-mail simulado em dev',
    );
    return;
  }

  await transport.sendMail({ from: env.smtpFrom, to, subject, html });
  logger.info({ event: 'email_sent', to, subject }, 'E-mail enviado com sucesso');
}
