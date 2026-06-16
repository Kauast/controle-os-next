import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { hashPassword, comparePassword } from '../../lib/hash';
import { audit } from '../../lib/audit';
import { sendEmail, buildPasswordResetEmail } from '../../lib/mailer';
import { AppError, UnauthorizedError } from '../../lib/errors';
import { authEventsTotal } from '../../lib/metrics';

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const REFRESH_TTL_DAYS = 7;
const REFRESH_TOKEN_COOKIE = 'refresh_token';

export { REFRESH_TOKEN_COOKIE };

export class AuthService {
  async login(data: { email: string; password: string }, ip?: string, userAgent?: string) {
    const user = await prisma.user.findFirst({
      where: { email: data.email },
      include: { company: { select: { id: true, name: true, active: true } } },
    });

    if (!user || !user.active || !user.company?.active) {
      await audit({ userEmail: data.email, action: 'LOGIN_FAILED', detail: 'Usuario nao encontrado ou inativo', ip });
      authEventsTotal.inc({ event: 'login_failed' });
      throw new UnauthorizedError('Credenciais invalidas');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      authEventsTotal.inc({ event: 'login_locked' });
      throw new AppError(`Conta bloqueada. Tente novamente em ${minutes} minuto(s).`, 423);
    }

    const valid = await comparePassword(data.password, user.password);

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
        companyId: user.companyId,
        userId: user.id,
        userEmail: user.email,
        action: 'LOGIN_FAILED',
        detail: `Tentativa ${attempts}/${MAX_ATTEMPTS}`,
        ip,
        userAgent,
      });

      authEventsTotal.inc({ event: 'login_failed' });

      if (shouldLock) {
        throw new AppError(`Conta bloqueada por ${LOCK_MINUTES} minutos apos ${MAX_ATTEMPTS} tentativas.`, 423);
      }
      throw new UnauthorizedError('Credenciais invalidas');
    }

    await prisma.user.updateMany({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null },
    });

    await audit({
      companyId: user.companyId,
      userId: user.id,
      userEmail: user.email,
      action: 'LOGIN',
      detail: 'Login realizado com sucesso',
      ip,
      userAgent,
    });

    authEventsTotal.inc({ event: 'login_success' });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      companyName: user.company?.name,
    };
  }

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  async issueRefreshToken(userId: string): Promise<string> {
    // Limita refresh tokens ativos por usuario (max 5 — previne abuso de sessoes paralelas)
    const activeCount = await prisma.refreshToken.count({ where: { userId, revokedAt: null } });
    if (activeCount >= 5) {
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    const rawToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60_000);

    // Persiste apenas o hash — o token cru nunca toca o banco
    await prisma.refreshToken.create({ data: { tokenHash, userId, expiresAt } });
    return rawToken;
  }

  async rotateRefreshToken(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);

    const record = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { company: true } } },
    });

    if (!record) {
      throw new AppError('Refresh token invalido ou expirado', 401);
    }

    // Deteccao de reuse: token ja revogado foi reapresentado — possivel roubo.
    // Revogar TODOS os tokens ativos como defesa.
    if (record.revokedAt) {
      await this.revokeAllUserTokens(record.userId);
      authEventsTotal.inc({ event: 'refresh_token_reuse_detected' });
      throw new AppError('Refresh token invalido ou expirado', 401);
    }

    if (record.expiresAt < new Date()) {
      throw new AppError('Refresh token invalido ou expirado', 401);
    }

    if (!record.user.active || !record.user.company?.active) {
      throw new AppError('Refresh token invalido ou expirado', 401);
    }

    // Rotacao: revogar token atual e emitir novo
    await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });

    const newToken = await this.issueRefreshToken(record.userId);
    authEventsTotal.inc({ event: 'token_refreshed' });

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

  async revokeRefreshToken(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    authEventsTotal.inc({ event: 'logout' });
  }

  async revokeAllUserTokens(userId: string) {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async forgotPassword(email: string, baseUrl: string, ip?: string) {
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user || !user.active) return; // nao revela existencia do e-mail

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
      'Redefinicao de senha',
      buildPasswordResetEmail(user.name ?? '', resetUrl, baseUrl),
    );

    await audit({ userId: user.id, userEmail: user.email, action: 'PASSWORD_RESET_REQUESTED', ip });
  }

  async resetPassword(rawToken: string, newPassword: string, ip?: string) {
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const record = await prisma.passwordResetToken.findFirst({
      where: { token: hashedToken, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!record) throw new AppError('Token invalido ou expirado', 400);

    const hashed = await hashPassword(newPassword);

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
    authEventsTotal.inc({ event: 'password_reset' });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string, ip?: string) {
    const user = await prisma.user.findFirst({ where: { id: userId } });
    if (!user) throw new AppError('Usuario nao encontrado', 404);

    const valid = await comparePassword(currentPassword, user.password);
    if (!valid) throw new AppError('Senha atual incorreta', 401);

    if (currentPassword === newPassword) throw new AppError('Nova senha nao pode ser igual a atual', 422);

    const hashed = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { password: hashed, passwordChangedAt: new Date(), loginAttempts: 0 },
      }),
      prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await audit({ userId, action: 'PASSWORD_CHANGED', ip });
    authEventsTotal.inc({ event: 'password_changed' });
  }
}
