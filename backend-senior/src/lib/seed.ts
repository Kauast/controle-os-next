import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // ─── Company ─────────────────────────────────────────────────────────────────
  const company = await prisma.company.upsert({
    where: { document: '00000000000000' },
    update: {},
    create: {
      id: 'default-company-id',
      name: 'Guardião Tech',
      document: '00000000000000',
      plan: 'ENTERPRISE',
      active: true,
    },
  });
  console.log('✅ Company:', company.name);

  // ─── Users ───────────────────────────────────────────────────────────────────
  const pw = await bcrypt.hash('Admin@1234', 12);
  const pwTech = await bcrypt.hash('Tech@1234', 12);

  const admin = await prisma.user.upsert({
    where: { email_companyId: { email: 'admin@guardiao.tech', companyId: company.id } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Administrador',
      email: 'admin@guardiao.tech',
      password: pw,
      role: 'ADMIN',
      active: true,
    },
  });

  const attendant = await prisma.user.upsert({
    where: { email_companyId: { email: 'atendimento@guardiao.tech', companyId: company.id } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Atendimento',
      email: 'atendimento@guardiao.tech',
      password: pw,
      role: 'ATTENDANT',
      active: true,
    },
  });

  const techUser = await prisma.user.upsert({
    where: { email_companyId: { email: 'tecnico@guardiao.tech', companyId: company.id } },
    update: {},
    create: {
      companyId: company.id,
      name: 'João Técnico',
      email: 'tecnico@guardiao.tech',
      password: pwTech,
      role: 'TECHNICIAN',
      active: true,
    },
  });

  const stockUser = await prisma.user.upsert({
    where: { email_companyId: { email: 'estoque@guardiao.tech', companyId: company.id } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Estoque',
      email: 'estoque@guardiao.tech',
      password: pw,
      role: 'STOCK',
      active: true,
    },
  });

  const financialUser = await prisma.user.upsert({
    where: { email_companyId: { email: 'financeiro@guardiao.tech', companyId: company.id } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Financeiro',
      email: 'financeiro@guardiao.tech',
      password: pw,
      role: 'FINANCIAL',
      active: true,
    },
  });

  console.log('✅ Usuários criados: admin, atendimento, técnico, estoque, financeiro');

  // ─── Technician ──────────────────────────────────────────────────────────────
  const technician = await prisma.technician.upsert({
    where: { userId: techUser.id },
    update: {},
    create: {
      companyId: company.id,
      userId: techUser.id,
      name: 'João Técnico',
      phone: '(11) 99999-0001',
      specialty: 'Redes e Fibra Óptica',
      maxConcurrentOS: 5,
      isActive: true,
    },
  });

  // ─── Team ────────────────────────────────────────────────────────────────────
  const team = await prisma.team.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Equipe Alpha' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Equipe Alpha',
      active: true,
    },
  });

  await prisma.teamMember.upsert({
    where: { teamId_technicianId: { teamId: team.id, technicianId: technician.id } },
    update: {},
    create: {
      teamId: team.id,
      technicianId: technician.id,
      isLeader: true,
    },
  });

  console.log('✅ Técnico e equipe criados');

  // ─── Product Categories ───────────────────────────────────────────────────────
  const categories = await Promise.all(
    ['Cabos e Conectores', 'Equipamentos de Rede', 'Chips e SIM Cards', 'Ferramentas', 'Materiais Elétricos'].map((name) =>
      prisma.productCategory.upsert({
        where: { companyId_name: { companyId: company.id, name } },
        update: {},
        create: { companyId: company.id, name },
      }),
    ),
  );

  console.log('✅ Categorias de produto criadas');

  // ─── Products ────────────────────────────────────────────────────────────────
  const catCabos = categories[0];
  const catChips = categories[2];

  const products = await Promise.all([
    prisma.product.upsert({
      where: { companyId_sku: { companyId: company.id, sku: 'CAB-001' } },
      update: {},
      create: {
        companyId: company.id,
        categoryId: catCabos.id,
        name: 'Cabo UTP Cat6 (metro)',
        sku: 'CAB-001',
        description: 'Cabo de rede UTP categoria 6',
        location: 'A1',
        minStock: 100,
        cost: 2.5,
        price: 5.0,
      },
    }),
    prisma.product.upsert({
      where: { companyId_sku: { companyId: company.id, sku: 'CHIP-001' } },
      update: {},
      create: {
        companyId: company.id,
        categoryId: catChips.id,
        name: 'Chip Vivo 4G',
        sku: 'CHIP-001',
        description: 'SIM Card Vivo 4G/LTE',
        location: 'B3',
        minStock: 10,
        cost: 15.0,
        price: 35.0,
      },
    }),
  ]);

  // Estoque inicial via StockMovement
  for (const product of products) {
    const existing = await prisma.stockMovement.findFirst({ where: { productId: product.id } });
    if (!existing) {
      await prisma.stockMovement.create({
        data: {
          companyId: company.id,
          productId: product.id,
          type: 'IN',
          quantity: 200,
          balanceBefore: 0,
          balanceAfter: 200,
          reason: 'Estoque inicial (seed)',
          userId: admin.id,
        },
      });
    }
  }

  console.log('✅ Produtos criados com estoque inicial');

  // ─── Clients ─────────────────────────────────────────────────────────────────
  const client = await prisma.client.upsert({
    where: { companyId_document: { companyId: company.id, document: '12345678901' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Cliente Demonstração',
      document: '12345678901',
      phone: '(11) 91234-5678',
      email: 'cliente@demo.com',
      address: 'Rua Demo, 100',
      neighborhood: 'Centro',
      city: 'São Paulo',
      state: 'SP',
    },
  });

  console.log('✅ Cliente de demonstração criado');

  // ─── Service Order de exemplo ─────────────────────────────────────────────────
  const existingOS = await prisma.serviceOrder.findFirst({ where: { companyId: company.id, number: 1 } });
  if (!existingOS) {
    const os = await prisma.serviceOrder.create({
      data: {
        companyId: company.id,
        number: 1,
        clientId: client.id,
        technicianId: technician.id,
        teamId: team.id,
        status: 'OPEN',
        priority: 'NORMAL',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60_000),
        totalAmount: 150.0,
        description: 'Instalação de rede + configuração roteador',
        createdById: admin.id,
        items: {
          create: [
            {
              description: 'Mão de obra - Instalação',
              quantity: 1,
              unitPrice: 100.0,
              discount: 0,
              total: 100.0,
              itemType: 'SERVICE',
            },
            {
              productId: products[0].id,
              description: 'Cabo UTP Cat6',
              quantity: 10,
              unitPrice: 5.0,
              discount: 0,
              total: 50.0,
              itemType: 'PRODUCT',
            },
          ],
        },
      },
    });

    await prisma.serviceOrderHistory.create({
      data: {
        serviceOrderId: os.id,
        userId: admin.id,
        action: 'OS_CRIADA',
        toStatus: 'OPEN',
        after: { number: 1, via: 'seed' },
      },
    });

    console.log('✅ OS de demonstração criada (nº 1)');
  }

  console.log('\n🚀 Seed concluído com sucesso!');
  console.log('─────────────────────────────────────────');
  console.log('Credenciais de acesso:');
  console.log('  Admin:      admin@guardiao.tech     / Admin@1234');
  console.log('  Atendimento:atendimento@guardiao.tech / Admin@1234');
  console.log('  Técnico:    tecnico@guardiao.tech   / Tech@1234');
  console.log('  Estoque:    estoque@guardiao.tech   / Admin@1234');
  console.log('  Financeiro: financeiro@guardiao.tech / Admin@1234');
  console.log('─────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
