import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

// Valor padrão hardcoded — NUNCA deve ser usado em produção.
const KNOWN_DEFAULT = 'Rb@2025#ControleOS';
const isProd = process.env.NODE_ENV === 'production';

if (
  isProd &&
  (!process.env.SEED_DEFAULT_PASS || process.env.SEED_DEFAULT_PASS === KNOWN_DEFAULT)
) {
  console.error(
    'FATAL: SEED_DEFAULT_PASS não definido ou usa o valor padrão hardcoded. ' +
    'Defina SEED_DEFAULT_PASS (ou senhas individuais SEED_ADMIN_PASS, etc.) no ambiente de produção.',
  );
  process.exit(1);
}

const DEFAULT_PASS = process.env.SEED_DEFAULT_PASS ?? KNOWN_DEFAULT;

// companyId da empresa de seed. Deve existir no banco antes de rodar este script.
// Configure SEED_COMPANY_ID no ambiente ou use o valor de dev hardcoded.
const SEED_COMPANY_ID = process.env.SEED_COMPANY_ID ?? 'seed-company-id';

const users = [
  { email: 'admin@controle.com',       password: process.env.SEED_ADMIN_PASS     ?? DEFAULT_PASS, role: 'ADMIN'      },
  { email: 'estoque@controle.com',     password: process.env.SEED_STOCK_PASS     ?? DEFAULT_PASS, role: 'STOCK'      },
  { email: 'tecnico@controle.com',     password: process.env.SEED_TECH_PASS      ?? DEFAULT_PASS, role: 'TECHNICIAN' },
  { email: 'atendimento@controle.com', password: process.env.SEED_ATTENDANT_PASS ?? DEFAULT_PASS, role: 'ATTENDANT'  },
  { email: 'financeiro@controle.com',  password: process.env.SEED_FINANCIAL_PASS ?? DEFAULT_PASS, role: 'FINANCIAL'  },
] as const;

async function main() {
  for (const u of users) {
    // Schema multi-tenant: unicidade é [email, companyId]
    const exists = await prisma.user.findFirst({
      where: { email: u.email, companyId: SEED_COMPANY_ID },
    });
    if (exists) { console.log(`Já existe: ${u.email}`); continue; }
    const hashed = await bcrypt.hash(u.password, 12);
    await prisma.user.create({
      data: {
        email: u.email,
        password: hashed,
        role: u.role,
        company: { connect: { id: SEED_COMPANY_ID } },
      },
    });
    console.log(`Criado: ${u.email} (${u.role})`);
  }
  await prisma.$disconnect();
}

main();
