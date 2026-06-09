import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService, loginSchema, registerSchema } from '../services/authService';

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
    return reply.send(request.user);
  }
}
