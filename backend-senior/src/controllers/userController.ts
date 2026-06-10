import { FastifyRequest, FastifyReply } from 'fastify';
import {
  UserService,
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
} from '../services/userService';

const service = new UserService();

export class UserController {
  async list(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await service.list());
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = createUserSchema.parse(request.body);
    const user = await service.create(data);
    return reply.status(201).send(user);
  }

  async update(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const data = updateUserSchema.parse(request.body);
    return reply.send(await service.update(request.params.id, data));
  }

  async resetPassword(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const { password } = resetPasswordSchema.parse(request.body);
    await service.resetPassword(request.params.id, password);
    return reply.send({ ok: true });
  }

  async remove(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const requester = request.user as { id: string };
    await service.remove(request.params.id, requester.id);
    return reply.status(204).send();
  }
}
