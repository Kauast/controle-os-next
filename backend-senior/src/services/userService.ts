import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

export const createUserSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  role: z
    .enum(['ADMIN', 'STOCK', 'TECHNICIAN', 'ATTENDANT', 'FINANCIAL'])
    .default('ATTENDANT'),
});

export const updateUserSchema = z
  .object({
    role: z.enum(['ADMIN', 'STOCK', 'TECHNICIAN', 'ATTENDANT', 'FINANCIAL']).optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => d.role !== undefined || d.active !== undefined, {
    message: 'Informe ao menos um campo para atualizar',
  });

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

const SELECT = {
  id: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
} as const;

export class UserService {
  async list() {
    return prisma.user.findMany({ select: SELECT, orderBy: { email: 'asc' } });
  }

  async create(data: CreateUserInput) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError('E-mail já cadastrado', 409);

    const hashed = await bcrypt.hash(data.password, 12);
    return prisma.user.create({
      data: { email: data.email, password: hashed, role: data.role },
      select: SELECT,
    });
  }

  async update(id: string, data: UpdateUserInput) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError('Usuário não encontrado', 404);

    return prisma.user.update({ where: { id }, data, select: SELECT });
  }

  async resetPassword(id: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError('Usuário não encontrado', 404);

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id }, data: { password: hashed } });
  }

  async remove(id: string, requesterId: string) {
    if (id === requesterId) {
      throw new AppError('Não é possível remover sua própria conta', 400);
    }
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError('Usuário não encontrado', 404);

    // Soft delete para preservar integridade referencial
    await prisma.user.update({ where: { id }, data: { active: false } });
  }
}
