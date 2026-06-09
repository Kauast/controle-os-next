import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'TECHNICIAN', 'ATTENDANT', 'FINANCIAL']).default('ATTENDANT'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export class AuthService {
  async register(data: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new Error('E-mail já cadastrado');

    const hashed = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: { email: data.email, password: hashed, role: data.role },
    });

    return { id: user.id, email: user.email, role: user.role };
  }

  async login(data: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user || !user.active) throw new Error('Credenciais inválidas');

    const valid = await bcrypt.compare(data.password, user.password);
    if (!valid) throw new Error('Credenciais inválidas');

    return { id: user.id, email: user.email, role: user.role };
  }
}
