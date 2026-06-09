import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService, loginSchema, registerSchema } from '../services/authService';
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
    const user = await service.login(data);

    const token = (request.server as any).jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      { expiresIn: '8h' }
    );

    return reply.send({ token, user });
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as { id: string; email: string; role: string };
    const technician = user.role === 'TECHNICIAN'
      ? await prisma.technician.findUnique({ where: { userId: user.id } })
      : null;
    return reply.send({ ...user, technician });
  }
}
