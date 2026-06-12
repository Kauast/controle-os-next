import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError, UnauthorizedError } from '../../shared/errors';
import { audit } from '../audit/audit.service';
import { sendEmail, buildPasswordResetEmail } from '../../lib/email';

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
});

export const registerSchema = z.object({
  name: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  role: z.enum(['ADMIN', 'SUPERVISOR', 'STOCK', 'TECHNICIAN', 'ATTENDANT', 'FINANCIAL']).default('ATTENDANT'),
  companyId: z.string().min(1),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const REFRESH_TTL_DAYS = 7;

export class AuthService {
  async register(data: RegisterInput) {
    const existing = await prisma.user.findFirst({ where: { email: data.email, companyId: data.companyId } });
    if (existing) throw new AppError('E-mail já cadastrado nesta empresa', 409);

    const company = await prisma.company.findUnique({ where: { id: data.companyId } });
    if (!company || !company.active) throw new AppError('Empresa não encontrada ou inativa', 404);

    const hashed = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: { companyId: data.companyId, name: data.name, email: data.email, password: hashed, role: data.role },
    });

    await audit({
      companyId: data.companyId, userId: user.id, userEmail: user.email,
      entity: 'User', entityId: user.id,
      action: 'USER_REGISTERED', after: { role: user.role },
    });

    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

  async login(data: LoginInput, ip?: string, userAgent?: string) {
    // Busca por email (pode haver mesmo email em empresas diferentes)
    // Para auth, o email deve ser único globalmente ou usar tenant prefix.
    // Aqui assumimos email único globalmente para simplificar o login.
    const user = await prisma.user.findFirst({
      where: { email: data.email },
      include: { company: { select: { id: true, name: true, active: true } } },
    });

    if (!user || !user.active || !user.company?.active) {
      await audit({ userEmail: data.email, action: 'LOGIN_FAILED', detail: 'Usuário não encontrado ou inativo', ip });
      throw new UnauthorizedError('Credenciais inválidas');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new AppError(`Conta bloqueada. Tente novamente em ${minutes} minuto(s).`, 423);
    }

    const valid = await bcrypt.compare(data.password, user.password);

    if (!valid) {
      const attempts = user.loginAttempts + 1;
      const shouldLock = attempts >= MAX_ATTEMPTS;

      await prisma.user.updateMany({
        where: { id: user.id },
        data: {
          loginAttempts: attempts,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        },
      });

      await audit({
        companyId: user.companyId, userId: user.id, userEmail: user.email,
        action: 'LOGIN_FAILED', detail: `Tentativa ${attempts}/${MAX_ATTEMPTS}`, ip, userAgent,
      });

      if (shouldLock) throw new AppError(`Conta bloqueada por ${LOCK_MINUTES} minutos após ${MAX_ATTEMPTS} tentativas.`, 423);
      throw new UnauthorizedError('Credenciais inválidas');
    }

    await prisma.user.updateMany({ where: { id: user.id }, data: { loginAttempts: 0, lockedUntil: null } });

    await audit({
      companyId: user.companyId, userId: user.id, userEmail: user.email,
      action: 'LOGIN', detail: 'Login realizado com sucesso', ip, userAgent,
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      companyName: user.company?.name,
    };
  }

  async issueRefreshToken(userId: string): Promise<string> {
    // Limita refresh tokens ativos por usuário (prevenção de abuso)
    const activeCount = await prisma.refreshToken.count({ where: { userId, revokedAt: null } });
    if (activeCount >= 5) {
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    const token = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60_000);
    await prisma.refreshToken.create({ data: { token, userId, expiresAt } });
    return token;
  }

  async rotateRefreshToken(token: string) {
    const record = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: { include: { company: true } } },
    });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new AppError('Refresh token inválido ou expirado', 401);
    }

    if (!record.user.active || !record.user.company?.active) {
      throw new AppError('Usuário ou empresa inativos', 401);
    }

    // Revogar token atual (rotação — previne reutilização)
    await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });

    const newToken = await this.issueRefreshToken(record.userId);

    return {
      user: {
        id: record.user.id,
        name: record.user.name,
        email: record.user.email,
        role: record.user.role,
        companyId: record.user.companyId,
      },
      refreshToken: newToken,
    };
  }

  async revokeRefreshToken(token: string) {
    await prisma.refreshToken.updateMany({ where: { token, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async revokeAllUserTokens(userId: string) {
    await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async forgotPassword(email: string, baseUrl: string, ip?: string) {
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user || !user.active) return; // não revela existência do e-mail

    // Invalida tokens pendentes anteriores
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60_000);

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token: hashedToken, expiresAt },
    });

    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
    await sendEmail(
      user.email,
      'Redefinição de senha',
      buildPasswordResetEmail(user.name ?? '', resetUrl, baseUrl),
    );

    await audit({ userId: user.id, userEmail: user.email, action: 'PASSWORD_RESET_REQUESTED', ip });
  }

  async resetPassword(rawToken: string, newPassword: string, ip?: string) {
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const record = await prisma.passwordResetToken.findFirst({
      where: { token: hashedToken, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!record) throw new AppError('Token inválido ou expirado', 400);

    const hashed = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { password: hashed, passwordChangedAt: new Date(), loginAttempts: 0 },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await audit({ userId: record.userId, action: 'PASSWORD_RESET', ip });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string, ip?: string) {
    const user = await prisma.user.findFirst({ where: { id: userId } });
    if (!user) throw new AppError('Usuário não encontrado', 404);

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new AppError('Senha atual incorreta', 401);

    if (currentPassword === newPassword) throw new AppError('Nova senha não pode ser igual à atual', 422);

    const hashed = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { password: hashed, passwordChangedAt: new Date(), loginAttempts: 0 },
      }),
      prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    await audit({ userId, action: 'PASSWORD_CHANGED', ip });
  }
}
