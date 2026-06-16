import { FastifyRequest, FastifyReply } from 'fastify';
import { UsersService } from './users.service';
import { createUserSchema, updateUserSchema, listUsersQuerySchema } from './users.schema';
import { AuthUser } from '../../plugins/jwt.plugin';
import { z } from 'zod';

const adminResetPasswordSchema = z.object({
  password: z.string().min(8, 'Senha deve ter no minimo 8 caracteres'),
});

const service = new UsersService();

export class UsersController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const requester = request.user as AuthUser;
    const query = listUsersQuerySchema.parse(request.query);
    return reply.send(await service.list(requester, query));
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const requester = request.user as AuthUser;
    // companyId vem do token — nunca do body (privilege escalation)
    const data = createUserSchema.parse(request.body);
    return reply.status(201).send(await service.create(data, requester));
  }

  async update(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const requester = request.user as AuthUser;
    const data = updateUserSchema.parse(request.body);
    return reply.send(await service.update(request.params.id, data, requester));
  }

  async remove(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const requester = request.user as AuthUser;
    await service.delete(request.params.id, requester);
    return reply.status(204).send();
  }

  async resetPassword(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const requester = request.user as AuthUser;
    const { password } = adminResetPasswordSchema.parse(request.body);
    await service.resetPasswordByAdmin(request.params.id, password, requester);
    return reply.send({ ok: true });
  }
}
