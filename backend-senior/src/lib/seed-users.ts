import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

// Senhas via env vars — se não definidas, usa defaults APENAS para desenvolvimento
// Em produção: defina SEED_ADMIN_PASS, SEED_STOCK_PASS, etc. antes de rodar
const users = [
  { email: 'admin@controle.com',       password: process.env.SEED_ADMIN_PASS      ?? 'MUDE-ANTES-DE-USAR', role: 'ADMIN'      },
  { email: 'estoque@controle.com',     password: process.env.SEED_STOCK_PASS      ?? 'MUDE-ANTES-DE-USAR', role: 'STOCK'      },
  { email: 'tecnico@controle.com',     password: process.env.SEED_TECH_PASS       ?? 'MUDE-ANTES-DE-USAR', role: 'TECHNICIAN' },
  { email: 'atendimento@controle.com', password: process.env.SEED_ATTENDANT_PASS  ?? 'MUDE-ANTES-DE-USAR', role: 'ATTENDANT'  },
  { email: 'financeiro@controle.com',  password: process.env.SEED_FINANCIAL_PASS  ?? 'MUDE-ANTES-DE-USAR', role: 'FINANCIAL'  },
] as const;

async function main() {
  for (const u of users) {
    if (u.password === 'MUDE-ANTES-DE-USAR') {
      console.warn(`AVISO: ${u.email} — senha não definida via env var. Defina SEED_*_PASS antes de usar em produção.`);
    }
    const exists = await prisma.user.findUnique({ where: { email: u.email } });
    if (exists) { console.log(`Já existe: ${u.email}`); continue; }
    const hashed = await bcrypt.hash(u.password, 12);
    await prisma.user.create({ data: { email: u.email, password: hashed, role: u.role } });
    console.log(`Criado: ${u.email} (${u.role})`);
  }
  await prisma.$disconnect();
}

main();
