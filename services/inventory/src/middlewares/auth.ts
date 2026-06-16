import type { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError } from '../lib/errors';

export interface JwtPayload {
  userId: string;
  companyId: string;
  name: string;
  role: string;
  iss?: string;
  aud?: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await req.jwtVerify();
    // O payload decodificado fica em req.user automaticamente via @fastify/jwt
  } catch {
    throw new UnauthorizedError('Token invalido ou ausente');
  }
}
