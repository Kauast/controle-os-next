import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AuditAction, RoleCode } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { sendEmail, buildPasswordResetEmail } from '../lib/email';
import { audit } from '../lib/audit';

export const registerSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email(),
  password: z.string().min(10),
  role: z.nativeEnum(RoleCode).default(RoleCode.ATTENDANT),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().min(1).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
  tenantSlug: z.string().min(1).optional(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(10, 'Senha deve ter no mínimo 10 caracteres'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

const BASE_LOCK_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const REFRESH_TOKEN_TTL_DAYS = 7;

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function resolveTenantId(tenantSlug?: string) {
  const slug = tenantSlug ?? process.env.DEFAULT_TENANT_SLUG ?? 'default';
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    throw new AppError(`Tenant '${slug}' não encontrado`, 404);
  }
  return tenant.id;
}

function lockMinutesForAttempt(attempts: number) {
  if (attempts < MAX_ATTEMPTS) return 0;
  const steps = attempts - MAX_ATTEMPTS;
  return Math.min(BASE_LOCK_MINUTES * Math.pow(2, steps), 24 * 60);
}

export class AuthService {
  async register(data: RegisterInput, tenantId: string) {
    const existing = await prisma.user.findFirst({
      where: { tenantId, email: data.email, deletedAt: null },
    });
    if (existing) throw new AppError('E-mail já cadastrado', 409);

    const hashed = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        tenantId,
        name: data.name,
        email: data.email.toLowerCase(),
        password: hashed,
        role: data.role,
      },
    });

    await audit({
      tenantId,
      userId: user.id,
      userEmail: user.email,
      entity: 'User',
      entityId: user.id,
      action: AuditAction.INSERT,
      after: { email: user.email, role: user.role },
    });

    return { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId };
  }

  async login(data: LoginInput, ip?: string, userAgent?: string) {
    const tenantId = await resolveTenantId(data.tenantSlug);
    const user = await prisma.user.findFirst({
      where: {
        tenantId,
        email: data.email.toLowerCase(),
        deletedAt: null,
      },
    });

    if (!user || !user.active) {
      await audit({
        tenantId,
        userEmail: data.email.toLowerCase(),
        action: AuditAction.LOGIN,
        detail: 'Falha de login: usuário não encontrado ou inativo',
        ip,
        userAgent,
      });
      throw new AppError('Credenciais inválidas', 401);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new AppError(`Conta bloqueada. Tente novamente em ${minutes} minuto(s).`, 423);
    }

    const valid = await bcrypt.compare(data.password, user.password);
    if (!valid) {
      const attempts = user.failedLoginCount + 1;
      const lockMinutes = lockMinutesForAttempt(attempts);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: attempts,
          failedLoginCount: attempts,
          lockedUntil: lockMinutes > 0 ? new Date(Date.now() + lockMinutes * 60 * 1000) : null,
          version: { increment: 1 },
        },
      });

      await audit({
        tenantId,
        userId: user.id,
        userEmail: user.email,
        entity: 'User',
        entityId: user.id,
        action: AuditAction.LOGIN,
        detail: `Falha de login. Tentativa ${attempts}`,
        ip,
        userAgent,
      });

      throw new AppError(lockMinutes > 0 ? `Conta bloqueada por ${lockMinutes} minuto(s).` : 'Credenciais inválidas', lockMinutes > 0 ? 423 : 401);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        version: { increment: 1 },
      },
    });

    await audit({
      tenantId,
      userId: user.id,
      userEmail: user.email,
      entity: 'User',
      entityId: user.id,
      action: AuditAction.LOGIN,
      detail: 'Login realizado com sucesso',
      ip,
      userAgent,
    });

    return {
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }

  async issueRefreshToken(userId: string, tenantId: string, meta?: { ip?: string; userAgent?: string; sessionId?: string }) {
    const rawToken = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    const sessionId = meta?.sessionId ?? crypto.randomUUID();

    await prisma.refreshToken.create({
      data: {
        tenantId,
        token: hashToken(rawToken),
        userId,
        sessionId,
        expiresAt,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      },
    });

    return rawToken;
  }

  async rotateRefreshToken(token: string, meta?: { ip?: string; userAgent?: string }) {
    const hashed = hashToken(token);
    const record = await prisma.refreshToken.findFirst({
      where: { token: hashed },
      include: { user: true },
    });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new AppError('Refresh token inválido ou expirado', 401);
    }

    if (!record.user.active || record.user.deletedAt) {
      throw new AppError('Usuário inativo', 401);
    }

    return prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date() },
      });

      const newToken = crypto.randomBytes(48).toString('hex');
      const newHash = hashToken(newToken);

      await tx.refreshToken.create({
        data: {
          tenantId: record.tenantId,
          token: newHash,
          userId: record.userId,
          sessionId: record.sessionId,
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
          ip: meta?.ip ?? record.ip,
          userAgent: meta?.userAgent ?? record.userAgent,
        },
      });

      await audit({
        tenantId: record.tenantId,
        userId: record.userId,
        userEmail: record.user.email,
        entity: 'RefreshToken',
        entityId: record.id,
        action: AuditAction.TOKEN_REFRESH,
        detail: 'Refresh token rotacionado',
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });

      return {
        user: {
          id: record.user.id,
          tenantId: record.user.tenantId,
          name: record.user.name,
          email: record.user.email,
          role: record.user.role,
        },
        refreshToken: newToken,
      };
    });
  }

  async revokeRefreshToken(token: string, meta?: { ip?: string; userAgent?: string }) {
    const hashed = hashToken(token);
    const record = await prisma.refreshToken.findFirst({ where: { token: hashed } });
    if (!record) return;

    await prisma.refreshToken.updateMany({
      where: { token: hashed, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await audit({
      tenantId: record.tenantId,
      userId: record.userId,
      entity: 'RefreshToken',
      entityId: record.id,
      action: AuditAction.LOGOUT,
      detail: 'Sessão encerrada',
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  }

  async revokeAllUserRefreshTokens(userId: string) {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async forgotPassword(email: string, baseUrl: string, ip?: string, userAgent?: string, tenantSlug?: string) {
    const tenantId = await resolveTenantId(tenantSlug);
    const user = await prisma.user.findFirst({
      where: { tenantId, email: email.toLowerCase(), active: true, deletedAt: null },
    });

    if (!user) return;

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: {
        tenantId,
        token: hashToken(rawToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
    const domain = new URL(baseUrl).hostname;
    const html = buildPasswordResetEmail(user.name ?? '', resetUrl, domain);
    await sendEmail(user.email, 'Redefinição de senha - Guardião', html);

    await audit({
      tenantId,
      userId: user.id,
      userEmail: user.email,
      entity: 'User',
      entityId: user.id,
      action: AuditAction.PASSWORD_RESET,
      detail: 'Solicitação de redefinição de senha',
      ip,
      userAgent,
    });
  }

  async resetPassword(token: string, newPassword: string, ip?: string, userAgent?: string) {
    const hashedToken = hashToken(token);
    const record = await prisma.passwordResetToken.findFirst({ where: { token: hashedToken } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new AppError('Link inválido ou expirado', 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: {
          password: passwordHash,
          loginAttempts: 0,
          failedLoginCount: 0,
          lockedUntil: null,
          passwordChangedAt: new Date(),
          version: { increment: 1 },
        },
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

    await audit({
      tenantId: record.tenantId,
      userId: record.userId,
      entity: 'User',
      entityId: record.userId,
      action: AuditAction.PASSWORD_RESET,
      detail: 'Senha redefinida',
      ip,
      userAgent,
    });
  }
}

