import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AuthService, loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from '../services/authService';
import { prisma } from '../lib/prisma';

const refreshBodySchema = z.object({
  refreshToken: z.string().optional(),
});

// Nome do cookie httpOnly utilizado para transporte do refresh token.
// Deve coincidir com o que o frontend envia (via Set-Cookie na resposta do login,
// caso o backend passe a setar cookies — atualmente o login retorna só JSON).
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

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
    return reply.send({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        companyName: user.companyName,
      },
    });
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as { id: string; name?: string; email: string; role: string; companyId: string };
    const technician = user.role === 'TECHNICIAN'
      ? await prisma.technician.findFirst({ where: { userId: user.id } })
      : null;
    return reply.send({ ...user, technician });
  }

  async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    const { email } = forgotPasswordSchema.parse(request.body);
    // ETAPA 2: usar somente APP_URL — nunca x-forwarded-* (Host Header Injection)
    const appUrl = process.env.APP_URL ?? '';
    await service.forgotPassword(email, appUrl, request.ip);
    return reply.send({ message: 'Se o e-mail existir, voce recebera um link em breve.' });
  }

  async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    const { token, password } = resetPasswordSchema.parse(request.body);
    await service.resetPassword(token, password, request.ip);
    return reply.send({ message: 'Senha redefinida com sucesso.' });
  }

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    // Aceita refresh token via cookie httpOnly (preferencial — seguro contra XSS)
    // OU via body JSON { refreshToken } (compatibilidade com clientes não-browser).
    // O cookie tem precedência quando presente.
    // Nota: @fastify/cookie não está instalado; parseia o header manualmente.
    const cookieHeader = request.headers.cookie ?? '';
    const cookieToken = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`))
      ?.slice(REFRESH_TOKEN_COOKIE.length + 1);

    const body = refreshBodySchema.parse(request.body ?? {});
    const token = cookieToken ?? body.refreshToken;

    if (!token) {
      return reply.status(401).send({ error: 'Refresh token ausente', code: 'UNAUTHORIZED' });
    }

    const { user, refreshToken: newRefreshToken } = await service.rotateRefreshToken(token);

    const accessToken = await reply.jwtSign({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    });

    // NÃO loga accessToken nem refreshToken
    return reply.send({ accessToken, refreshToken: newRefreshToken });
  }
}
