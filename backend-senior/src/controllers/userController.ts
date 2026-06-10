import { FastifyRequest, FastifyReply } from 'fastify';
import { UserService, createUserSchema, updateUserSchema, resetPasswordSchema } from '../services/userService';

const service = new UserService();
type AuthUser = { id: string; email: string; role: string };

export class UserController {
  async list(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await service.list());
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = createUserSchema.parse(request.body);
    const req = request.user as AuthUser;
    return reply.status(201).send(await service.create(data, req.id, req.email));
  }

  async update(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const data = updateUserSchema.parse(request.body);
    const req = request.user as AuthUser;
    return reply.send(await service.update(request.params.id, data, req.id, req.email));
  }

  async resetPassword(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { password } = resetPasswordSchema.parse(request.body);
    const req = request.user as AuthUser;
    await service.resetPassword(request.params.id, password, req.id, req.email);
    return reply.send({ ok: true });
  }

  async remove(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const req = request.user as AuthUser;
    await service.remove(request.params.id, req.id, req.email);
    return reply.status(204).send();
  }
}
