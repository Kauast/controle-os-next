import { env } from '../env';

export interface JwtPayload {
  sub: string;
  companyId: string;
  role: string;
  name?: string;
  email?: string;
  iss: string;
  aud: string;
  iat?: number;
  exp?: number;
}

/**
 * O Identity Service é o único emissor de JWT.
 * Outros serviços apenas verificam — nunca emitem.
 *
 * O token é assinado pelo @fastify/jwt através de reply.jwtSign().
 * Este módulo exporta apenas constantes e o tipo do payload.
 */
export const JWT_CONFIG = {
  secret: env.JWT_SECRET,
  sign: {
    expiresIn: env.JWT_EXPIRES_IN,
    iss: env.JWT_ISSUER,    // 'identity-svc'
    aud: env.JWT_AUDIENCE,  // 'controle-os'
  },
};
