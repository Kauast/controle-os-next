import { FastifyReply, FastifyRequest } from 'fastify';
import {
  AuthService,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../services/authService';
import { prisma } from '../lib/prisma';

const service = new AuthService();

export class AuthController {
  async register(request: FastifyRequest, reply: FastifyReply) {
    const data = registerSchema.parse(request.body);
    const user = request.user as { tenantId: string };
    const created = await service.register(data, user.tenantId);
    return reply.status(201).send(created);
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const data = loginSchema.parse(request.body);
    const user = await service.login(data, request.ip, request.headers['user-agent']);

    const accessToken = await reply.jwtSign(
      {
        id: user.id,
        tenantId: user.tenantId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      { expiresIn: process.env.JWT_EXPIRES_IN ?? '15m' },
    );

    const refreshToken = await service.issueRefreshToken(user.id, user.tenantId, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.send({ accessToken, refreshToken, user });
  }

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as { refreshToken?: string };
    if (!body?.refreshToken) {
      return reply.status(400).send({ error: 'refreshToken é obrigatório' });
    }

    const rotated = await service.rotateRefreshToken(body.refreshToken, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    const accessToken = await reply.jwtSign(
      {
        id: rotated.user.id,
        tenantId: rotated.user.tenantId,
        name: rotated.user.name,
        email: rotated.user.email,
        role: rotated.user.role,
      },
      { expiresIn: process.env.JWT_EXPIRES_IN ?? '15m' },
    );

    return reply.send({ accessToken, refreshToken: rotated.refreshToken, user: rotated.user });
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as { refreshToken?: string };
    if (body?.refreshToken) {
      await service.revokeRefreshToken(body.refreshToken, {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
    }
    return reply.send({ ok: true });
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as { id: string; tenantId: string; name?: string; email: string; role: string; permissions?: string[] };
    const technician = user.role === 'TECHNICIAN'
      ? await prisma.technician.findFirst({ where: { userId: user.id, tenantId: user.tenantId, deletedAt: null } })
      : null;

    return reply.send({ ...user, technician });
  }

  async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    const { email, tenantSlug } = forgotPasswordSchema.parse(request.body);
    const proto = request.headers['x-forwarded-proto'] ?? 'https';
    const host = request.headers['x-forwarded-host'] ?? request.hostname;
    const baseUrl = `${proto}://${host}`;
    await service.forgotPassword(email, baseUrl, request.ip, request.headers['user-agent'], tenantSlug);
    return reply.send({ message: 'Se o e-mail existir, você receberá um link em breve.' });
  }

  async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    const { token, password } = resetPasswordSchema.parse(request.body);
    await service.resetPassword(token, password, request.ip, request.headers['user-agent']);
    return reply.send({ message: 'Senha redefinida com sucesso.' });
  }
}

