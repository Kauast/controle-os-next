import type { ImportClientRow } from "@/hooks/useClients";

/**
 * Faz o parsing de uma única linha CSV respeitando campos entre aspas.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  result.push(current);
  return result;
}

/**
 * Normaliza um número de telefone bruto extraído de CSV:
 * mantém apenas o primeiro número quando há múltiplos separados por espaços duplos,
 * remove caracteres inválidos e limita a 20 caracteres.
 */
function cleanPhone(raw: string): string {
  if (!raw) return "";
  const first = raw.split(/\s{2,}/)[0].trim();
  return first.replace(/[^\d+()\-\s]/g, "").trim().slice(0, 20);
}

/**
 * Faz o parsing de um arquivo CSV de clientes no formato padrão do sistema.
 *
 * Colunas esperadas: codigo, fantasia, razao_social, responsavel,
 * logradouro, bairro, cidade, uf, telefone_1
 *
 * Retorna uma lista de {@link ImportClientRow} pronta para envio à API.
 */
export function parseClientCSV(text: string): ImportClientRow[] {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = parseCSVLine(lines[0]);

  const idx = {
    codigo:       header.indexOf("codigo"),
    fantasia:     header.indexOf("fantasia"),
    razao_social: header.indexOf("razao_social"),
    responsavel:  header.indexOf("responsavel"),
    logradouro:   header.indexOf("logradouro"),
    bairro:       header.indexOf("bairro"),
    cidade:       header.indexOf("cidade"),
    uf:           header.indexOf("uf"),
    telefone_1:   header.indexOf("telefone_1"),
  };

  const seen = new Map<string, number>();
  const rows: ImportClientRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    const codigo  = cols[idx.codigo]?.trim() ?? "";
    const fantasia = cols[idx.fantasia]?.trim() ?? "";
    const razao   = cols[idx.razao_social]?.trim() ?? "";
    const name    = fantasia || razao || `CLIENTE-${codigo}`;

    const base  = codigo.padStart(4, "0");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const document = count === 0 ? base : `${base}-${count}`;

    rows.push({
      name,
      document,
      phone:       cleanPhone(cols[idx.telefone_1] ?? "") || undefined,
      address:     cols[idx.logradouro]?.trim() || undefined,
      neighborhood: cols[idx.bairro]?.trim() || undefined,
      city:        cols[idx.cidade]?.trim() || undefined,
      state:       cols[idx.uf]?.trim() || undefined,
      contactName: cols[idx.responsavel]?.trim() || undefined,
    });
  }

  return rows;
}
