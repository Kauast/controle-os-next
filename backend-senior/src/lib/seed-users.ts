import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

// Valor padrão hardcoded — NUNCA deve ser usado em produção.
const KNOWN_DEFAULT = 'Rb@2025#ControleOS';
const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  const missingPasses = [
    process.env.SEED_ADMIN_PASS,
    process.env.SEED_STOCK_PASS,
    process.env.SEED_TECH_PASS,
    process.env.SEED_ATTENDANT_PASS,
    process.env.SEED_FINANCIAL_PASS,
  ].some((p) => !p);

  if (missingPasses || process.env.SEED_DEFAULT_PASS === KNOWN_DEFAULT) {
    console.error(
      'FATAL: Senhas de seed ausentes ou usando valor padrão hardcoded. ' +
      'Defina SEED_ADMIN_PASS, SEED_STOCK_PASS, SEED_TECH_PASS, SEED_ATTENDANT_PASS, SEED_FINANCIAL_PASS ' +
      'no ambiente de produção. NUNCA use a senha padrão hardcoded.',
    );
    process.exit(1);
  }
}

const DEFAULT_PASS = process.env.SEED_DEFAULT_PASS ?? KNOWN_DEFAULT;

const DEMO_COMPANY = {
  name: 'Empresa Demo',
  document: '00000000000100',
  plan: 'PROFESSIONAL' as const,
  active: true,
};

const users = [
  { email: 'admin@controle.com',       password: process.env.SEED_ADMIN_PASS     ?? DEFAULT_PASS, role: 'ADMIN'      as const },
  { email: 'estoque@controle.com',     password: process.env.SEED_STOCK_PASS     ?? DEFAULT_PASS, role: 'STOCK'      as const },
  { email: 'tecnico@controle.com',     password: process.env.SEED_TECH_PASS      ?? DEFAULT_PASS, role: 'TECHNICIAN' as const },
  { email: 'atendimento@controle.com', password: process.env.SEED_ATTENDANT_PASS ?? DEFAULT_PASS, role: 'ATTENDANT'  as const },
  { email: 'financeiro@controle.com',  password: process.env.SEED_FINANCIAL_PASS ?? DEFAULT_PASS, role: 'FINANCIAL'  as const },
];

async function main() {
  // Criar ou encontrar Company padrão pelo documento
  let company = await prisma.company.findFirst({ where: { document: DEMO_COMPANY.document } });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: DEMO_COMPANY.name,
        document: DEMO_COMPANY.document,
        plan: DEMO_COMPANY.plan,
        active: DEMO_COMPANY.active,
      },
    });
    console.log(`Empresa criada: ${company.name} (id: ${company.id})`);
  } else {
    console.log(`Empresa encontrada: ${company.name} (id: ${company.id})`);
  }

  for (const u of users) {
    // Schema multi-tenant: unicidade é [email, companyId]
    const exists = await prisma.user.findFirst({
      where: { email: u.email, companyId: company.id },
    });

    if (exists) {
      console.log(`Usuario ja existe: ${u.email}`);
      continue;
    }

    const hashed = await bcrypt.hash(u.password, 12);
    await prisma.user.create({
      data: {
        email: u.email,
        password: hashed,
        role: u.role,
        company: { connect: { id: company.id } },
      },
    });
    console.log(`Usuario criado: ${u.email} (${u.role})`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Erro no seed-users:', e);
  process.exit(1);
});
