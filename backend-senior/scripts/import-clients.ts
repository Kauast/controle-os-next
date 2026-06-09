/**
 * Script de importação de clientes a partir do CSV exportado do sistema legado.
 * Uso: npx tsx scripts/import-clients.ts [caminho-do-csv]
 *
 * Colunas esperadas: codigo,fantasia,razao_social,responsavel,logradouro,
 *                    bairro,cidade,uf,telefone_1,telefone_2,...
 */
import { createReadStream } from 'fs';
import { resolve } from 'path';
import { createInterface } from 'readline';
import { prisma } from '../src/lib/prisma';

const CSV_PATH = process.argv[2] ?? resolve(process.env.HOME ?? '', 'Downloads', 'clientes_controle_os.csv');

function cleanPhone(raw: string): string {
  if (!raw) return '';
  const first = raw.split(/\s{2,}|\s+(?=[0-9(])/)[0].trim();
  return first.replace(/[^\d+()\-\s]/g, '').trim().slice(0, 20);
}

function buildDocument(codigo: string, fantasia: string, seen: Map<string, number>): string {
  const base = codigo.trim().padStart(4, '0');
  const key = base;
  const count = seen.get(key) ?? 0;
  seen.set(key, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function main() {
  console.log(`📂 Lendo CSV: ${CSV_PATH}`);

  const rl = createInterface({ input: createReadStream(CSV_PATH), crlfDelay: Infinity });
  const lines: string[] = [];

  for await (const line of rl) {
    lines.push(line);
  }

  const header = parseCSVLine(lines[0]);
  const idx = {
    codigo: header.indexOf('codigo'),
    fantasia: header.indexOf('fantasia'),
    razao_social: header.indexOf('razao_social'),
    responsavel: header.indexOf('responsavel'),
    logradouro: header.indexOf('logradouro'),
    bairro: header.indexOf('bairro'),
    cidade: header.indexOf('cidade'),
    uf: header.indexOf('uf'),
    telefone_1: header.indexOf('telefone_1'),
  };

  const seen = new Map<string, number>();
  let created = 0, skipped = 0, errors = 0;

  console.log(`📊 Total de linhas: ${lines.length - 1}`);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    const codigo = cols[idx.codigo]?.trim() ?? '';
    const fantasia = cols[idx.fantasia]?.trim() ?? '';
    const razao = cols[idx.razao_social]?.trim() ?? '';
    const name = fantasia || razao || `CLIENTE-${codigo}`;

    const document = buildDocument(codigo, fantasia, seen);
    const phone = cleanPhone(cols[idx.telefone_1] ?? '');
    const address = cols[idx.logradouro]?.trim() ?? '';
    const neighborhood = cols[idx.bairro]?.trim() ?? '';
    const city = cols[idx.cidade]?.trim() ?? '';
    const state = cols[idx.uf]?.trim() ?? '';
    const contactName = cols[idx.responsavel]?.trim() ?? '';

    try {
      const existing = await prisma.client.findUnique({ where: { document } });
      if (existing) {
        skipped++;
        continue;
      }
      await prisma.client.create({
        data: {
          name,
          document,
          phone: phone || undefined,
          address: address || undefined,
          neighborhood: neighborhood || undefined,
          city: city || undefined,
          state: state || undefined,
          contactName: contactName || undefined,
        },
      });
      created++;
      if (created % 50 === 0) process.stdout.write(`\r✅ ${created} criados...`);
    } catch (e: unknown) {
      errors++;
      if (errors <= 5) {
        console.error(`\n❌ Linha ${i + 1} (${document}): ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  console.log(`\n\n📋 Resultado:`);
  console.log(`  ✅ Criados: ${created}`);
  console.log(`  ⏭️  Pulados (já existiam): ${skipped}`);
  console.log(`  ❌ Erros: ${errors}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
