import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

const users = [
  { email: 'admin@controle.com',      password: 'admin123',     role: 'ADMIN'      },
  { email: 'estoque@controle.com',    password: 'estoque123',   role: 'STOCK'      },
  { email: 'tecnico@controle.com',    password: 'tecnico123',   role: 'TECHNICIAN' },
  { email: 'atendimento@controle.com',password: 'atend123',     role: 'ATTENDANT'  },
  { email: 'financeiro@controle.com', password: 'financeiro123',role: 'FINANCIAL'  },
] as const;

async function main() {
  for (const u of users) {
    const exists = await prisma.user.findUnique({ where: { email: u.email } });
    if (exists) { console.log(`Já existe: ${u.email}`); continue; }
    const hashed = await bcrypt.hash(u.password, 12);
    await prisma.user.create({ data: { email: u.email, password: hashed, role: u.role } });
    console.log(`Criado: ${u.email} (${u.role})`);
  }
  await prisma.$disconnect();
}

main();
