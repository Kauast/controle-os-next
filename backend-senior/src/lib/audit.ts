import { prisma } from './prisma';

export async function audit(params: {
  userId?: string;
  userEmail?: string;
  action: string;
  detail?: string;
  ip?: string;
}) {
  try {
    await prisma.auditLog.create({ data: params });
  } catch {
    // nunca derrubar a requisicao por falha de auditoria
  }
}
