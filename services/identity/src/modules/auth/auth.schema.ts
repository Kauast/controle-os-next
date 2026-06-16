import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('E-mail invalido'),
  password: z.string().min(1, 'Senha obrigatoria'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('E-mail invalido'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token obrigatorio'),
  password: z.string().min(8, 'Senha deve ter no minimo 8 caracteres'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual obrigatoria'),
  newPassword: z.string().min(8, 'Nova senha deve ter no minimo 8 caracteres'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Fastify JSON Schema para documentacao e validacao rápida
export const loginJsonSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 1 },
    },
  },
};

export const refreshJsonSchema = {
  body: {
    type: 'object',
    properties: {
      refreshToken: { type: 'string' },
    },
  },
};

export const forgotPasswordJsonSchema = {
  body: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email' },
    },
  },
};

export const resetPasswordJsonSchema = {
  body: {
    type: 'object',
    required: ['token', 'password'],
    properties: {
      token: { type: 'string' },
      password: { type: 'string', minLength: 8 },
    },
  },
};
