import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

const DEFAULT_PASS = process.env.SEED_DEFAULT_PASS ?? 'Rb@2025#ControleOS';

const users = [
  { email: 'admin@controle.com',       password: process.env.SEED_ADMIN_PASS     ?? DEFAULT_PASS, role: 'ADMIN'      },
  { email: 'estoque@controle.com',     password: process.env.SEED_STOCK_PASS     ?? DEFAULT_PASS, role: 'STOCK'      },
  { email: 'tecnico@controle.com',     password: process.env.SEED_TECH_PASS      ?? DEFAULT_PASS, role: 'TECHNICIAN' },
  { email: 'atendimento@controle.com', password: process.env.SEED_ATTENDANT_PASS ?? DEFAULT_PASS, role: 'ATTENDANT'  },
  { email: 'financeiro@controle.com',  password: process.env.SEED_FINANCIAL_PASS ?? DEFAULT_PASS, role: 'FINANCIAL'  },
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
