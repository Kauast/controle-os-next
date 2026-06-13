import { FastifyRequest, FastifyReply } from 'fastify';
import { UserService, createUserSchema, updateUserSchema, resetPasswordSchema } from '../services/userService';

const service = new UserService();
type AuthUser = { id: string; email: string; role: string; companyId: string };

export class UserController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const req = request.user as AuthUser;
    return reply.send(await service.list(req.companyId));
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const req = request.user as AuthUser;
    const body = request.body as Record<string, unknown>;
    // companyId vem do token autenticado — não do body (evita privilege escalation)
    const data = createUserSchema.parse({ ...body, companyId: req.companyId });
    return reply.status(201).send(await service.create(data, req.id, req.email));
  }

  async update(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const req = request.user as AuthUser;
    const data = updateUserSchema.parse(request.body);
    return reply.send(await service.update(request.params.id, req.companyId, data, req.id, req.email));
  }

  async resetPassword(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const req = request.user as AuthUser;
    const { password } = resetPasswordSchema.parse(request.body);
    await service.resetPassword(request.params.id, req.companyId, password, req.id, req.email);
    return reply.send({ ok: true });
  }

  async remove(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const req = request.user as AuthUser;
    await service.remove(request.params.id, req.companyId, req.id, req.email);
    return reply.status(204).send();
  }
}
