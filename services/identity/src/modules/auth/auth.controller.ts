import { FastifyRequest, FastifyReply } from 'fastify';
import {
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from './auth.schema';
import { AuthService, REFRESH_TOKEN_COOKIE } from './auth.service';
import { AuthUser } from '../../plugins/jwt.plugin';
import { env } from '../../env';

const service = new AuthService();

export class AuthController {
  async login(request: FastifyRequest, reply: FastifyReply) {
    const data = loginSchema.parse(request.body);
    const user = await service.login(data, request.ip, request.headers['user-agent']);

    // O Identity Service é o único emissor de JWT.
    // Payload segue o contrato: { sub, companyId, role, iss, aud }
    const accessToken = await reply.jwtSign({
      sub: user.id,
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

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    // Aceita token via cookie httpOnly (preferencial) OU body JSON
    const cookieHeader = request.headers.cookie ?? '';
    const cookieToken = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`))
      ?.slice(REFRESH_TOKEN_COOKIE.length + 1);

    const body = refreshSchema.parse(request.body ?? {});
    const token = cookieToken ?? body.refreshToken;

    if (!token) {
      return reply.status(401).send({ error: 'Refresh token ausente', code: 'UNAUTHORIZED' });
    }

    const { user, refreshToken: newRefreshToken } = await service.rotateRefreshToken(token);

    const accessToken = await reply.jwtSign({
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    });

    return reply.send({ accessToken, refreshToken: newRefreshToken });
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const body = refreshSchema.parse(request.body ?? {});
    const cookieHeader = request.headers.cookie ?? '';
    const cookieToken = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`))
      ?.slice(REFRESH_TOKEN_COOKIE.length + 1);

    const token = cookieToken ?? body.refreshToken;
    if (token) {
      await service.revokeRefreshToken(token);
    }

    return reply.send({ message: 'Sessao encerrada com sucesso.' });
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as AuthUser;
    return reply.send({
      id: user.sub,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    });
  }

  async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    const { email } = forgotPasswordSchema.parse(request.body);
    // APP_URL definida em env — nunca usar x-forwarded-host (Host Header Injection)
    const appUrl = env.APP_URL ?? '';
    await service.forgotPassword(email, appUrl, request.ip);
    return reply.send({ message: 'Se o e-mail existir, voce recebera um link em breve.' });
  }

  async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    const { token, password } = resetPasswordSchema.parse(request.body);
    await service.resetPassword(token, password, request.ip);
    return reply.send({ message: 'Senha redefinida com sucesso.' });
  }

  async changePassword(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as AuthUser;
    const { currentPassword, newPassword } = changePasswordSchema.parse(request.body);
    await service.changePassword(user.sub, currentPassword, newPassword, request.ip);
    return reply.send({ message: 'Senha alterada com sucesso.' });
  }
}
