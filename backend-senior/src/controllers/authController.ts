import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService, loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from '../services/authService';
import { prisma } from '../lib/prisma';

const service = new AuthService();

export class AuthController {
  async register(request: FastifyRequest, reply: FastifyReply) {
    const data = registerSchema.parse(request.body);
    const user = await service.register(data);
    return reply.status(201).send(user);
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const data = loginSchema.parse(request.body);
    const user = await service.login(data, request.ip);
    const accessToken = await reply.jwtSign({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    });
    const refreshToken = await service.issueRefreshToken(user.id);
    return reply.send({ accessToken, refreshToken, user });
  }

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const body = (request.body ?? {}) as { refreshToken?: string };
    if (!body.refreshToken) {
      return reply.status(400).send({ error: 'refreshToken obrigatorio' });
    }

    const { user, refreshToken } = await service.rotateRefreshToken(body.refreshToken);
    const accessToken = await reply.jwtSign({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    });

    return reply.send({ accessToken, refreshToken, user });
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const body = (request.body ?? {}) as { refreshToken?: string };
    if (body.refreshToken) {
      await service.revokeRefreshToken(body.refreshToken);
    }
    return reply.send({ ok: true });
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as { id: string; name?: string; email: string; role: string; companyId: string };
    const technician = user.role === 'TECHNICIAN'
      ? await prisma.technician.findFirst({ where: { userId: user.id, companyId: user.companyId } })
      : null;
    return reply.send({ ...user, technician });
  }

  async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    const { email } = forgotPasswordSchema.parse(request.body);
    const proto = request.headers['x-forwarded-proto'] ?? 'https';
    const host  = request.headers['x-forwarded-host'] ?? request.hostname;
    const baseUrl = proto + '://' + host;
    await service.forgotPassword(email, baseUrl as string, request.ip);
    return reply.send({ message: 'Se o e-mail existir, voce recebera um link em breve.' });
  }

  async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    const { token, password } = resetPasswordSchema.parse(request.body);
    await service.resetPassword(token, password, request.ip);
    return reply.send({ message: 'Senha redefinida com sucesso.' });
  }
}
