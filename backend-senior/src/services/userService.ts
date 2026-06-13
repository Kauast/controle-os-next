import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { audit } from '../lib/audit';

const ROLES = ['ADMIN', 'SUPERVISOR', 'STOCK', 'TECHNICIAN', 'ATTENDANT', 'FINANCIAL'] as const;

export const createUserSchema = z.object({
  name: z.string().optional(),
  email: z.string().email('E-mail invalido'),
  password: z.string().min(8, 'Senha deve ter no minimo 8 caracteres'),
  role: z.enum(ROLES).default('ATTENDANT'),
  companyId: z.string().min(1, 'companyId obrigatorio'),
});

export const updateUserSchema = z
  .object({
    name: z.string().optional(),
    role: z.enum(ROLES).optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'Informe ao menos um campo para atualizar',
  });

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Senha deve ter no minimo 8 caracteres'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

const SELECT = { id: true, name: true, email: true, role: true, active: true, createdAt: true } as const;

export class UserService {
  async list(companyId: string) {
    return prisma.user.findMany({
      where: { companyId },
      select: SELECT,
      orderBy: { email: 'asc' },
    });
  }

  async create(data: CreateUserInput, requesterId?: string, requesterEmail?: string) {
    const existing = await prisma.user.findFirst({
      where: { email: data.email, companyId: data.companyId },
    });
    if (existing) throw new AppError('E-mail ja cadastrado', 409);
    const hashed = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashed,
        role: data.role,
        companyId: data.companyId,
      },
      select: SELECT,
    });
    await audit({ userId: requesterId, userEmail: requesterEmail, action: 'USUARIO_CRIADO', detail: user.email + ' (' + data.role + ')' });
    return user;
  }

  async update(id: string, companyId: string, data: UpdateUserInput, requesterId?: string, requesterEmail?: string) {
    const user = await prisma.user.findFirst({ where: { id, companyId } });
    if (!user) throw new AppError('Usuario nao encontrado', 404);
    const updated = await prisma.user.update({ where: { id }, data, select: SELECT });
    await audit({ userId: requesterId, userEmail: requesterEmail, action: 'USUARIO_ATUALIZADO', detail: user.email + ' — ' + JSON.stringify(data) });
    return updated;
  }

  async resetPassword(id: string, companyId: string, newPassword: string, requesterId?: string, requesterEmail?: string) {
    const user = await prisma.user.findFirst({ where: { id, companyId } });
    if (!user) throw new AppError('Usuario nao encontrado', 404);
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id }, data: { password: hashed } });
    await audit({ userId: requesterId, userEmail: requesterEmail, action: 'SENHA_REDEFINIDA_ADMIN', detail: 'Senha de ' + user.email + ' redefinida pelo admin' });
  }

  async remove(id: string, companyId: string, requesterId: string, requesterEmail?: string) {
    if (id === requesterId) throw new AppError('Nao e possivel remover sua propria conta', 400);
    const user = await prisma.user.findFirst({ where: { id, companyId } });
    if (!user) throw new AppError('Usuario nao encontrado', 404);
    await prisma.user.update({ where: { id }, data: { active: false } });
    await audit({ userId: requesterId, userEmail: requesterEmail, action: 'USUARIO_DESATIVADO', detail: user.email + ' desativado' });
  }
}
