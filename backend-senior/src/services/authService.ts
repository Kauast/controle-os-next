import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { sendEmail, buildPasswordResetEmail } from '../lib/email';
import { audit } from '../lib/audit';

export const registerSchema = z.object({
  name: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'SUPERVISOR', 'STOCK', 'TECHNICIAN', 'ATTENDANT', 'FINANCIAL']).default('ATTENDANT'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Senha deve ter no minimo 8 caracteres'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export class AuthService {
  async register(data: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError('E-mail ja cadastrado', 409);
    const hashed = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, password: hashed, role: data.role },
    });
    await audit({ userId: user.id, userEmail: user.email, action: 'USUARIO_CRIADO', detail: 'Perfil: ' + data.role });
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

  async login(data: LoginInput, ip?: string) {
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user || !user.active) {
      await audit({ userEmail: data.email, action: 'LOGIN_FALHOU', detail: 'Usuario nao encontrado ou inativo', ip });
      throw new AppError('Credenciais invalidas', 401);
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new AppError('Conta bloqueada. Tente novamente em ' + minutes + ' minuto(s).', 423);
    }
    const valid = await bcrypt.compare(data.password, user.password);
    if (!valid) {
      const attempts = user.loginAttempts + 1;
      const locked = attempts >= MAX_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: attempts,
          lockedUntil: locked ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null,
        },
      });
      await audit({ userId: user.id, userEmail: user.email, action: 'LOGIN_FALHOU', detail: 'Tentativa ' + attempts + '/' + MAX_ATTEMPTS, ip });
      if (locked) throw new AppError('Conta bloqueada por ' + LOCK_MINUTES + ' minutos apos ' + MAX_ATTEMPTS + ' tentativas.', 423);
      throw new AppError('Credenciais invalidas', 401);
    }
    await prisma.user.update({ where: { id: user.id }, data: { loginAttempts: 0, lockedUntil: null } });
    await audit({ userId: user.id, userEmail: user.email, action: 'LOGIN', detail: 'Login realizado com sucesso', ip });
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

  async forgotPassword(email: string, baseUrl: string, ip?: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) return;
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    const token = crypto.randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    });
    const resetUrl = baseUrl + '/reset-password?token=' + token;
    const domain = new URL(baseUrl).hostname;
    const html = buildPasswordResetEmail(user.name ?? '', resetUrl, domain);
    await sendEmail(user.email, 'Redefinicao de senha - Guardiao', html);
    await audit({ userId: user.id, userEmail: user.email, action: 'SENHA_RESET_SOLICITADO', ip });
  }

  async resetPassword(token: string, newPassword: string, ip?: string) {
    const record = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new AppError('Link invalido ou expirado', 400);
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: record.userId },
      data: { password: hashed, loginAttempts: 0, lockedUntil: null },
    });
    await prisma.passwordResetToken.update({ where: { token }, data: { usedAt: new Date() } });
    const user = await prisma.user.findUnique({ where: { id: record.userId } });
    await audit({ userId: record.userId, userEmail: user?.email, action: 'SENHA_REDEFINIDA', ip });
  }
}
