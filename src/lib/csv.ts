import type { ImportClientRow } from "@/hooks/useClients";

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values.map((value) => value.replace(/^"|"$/g, "").trim());
}

function mapHeader(header: string): keyof ImportClientRow | null {
  const normalized = normalizeHeader(header);

  const dictionary: Record<string, keyof ImportClientRow> = {
    nome: "name",
    razao_social: "name",
    razao_social_nome: "name",
    document: "document",
    documento: "document",
    cpf: "document",
    cnpj: "document",
    codigo: "document",
    telefone: "phone",
    phone: "phone",
    endereco: "address",
    address: "address",
    bairro: "neighborhood",
    neighborhood: "neighborhood",
    cidade: "city",
    city: "city",
    estado: "state",
    uf: "state",
    state: "state",
    responsavel: "contactName",
    contato: "contactName",
    contactname: "contactName",
  };

  return dictionary[normalized] ?? null;
}

export function parseClientCSV(text: string): ImportClientRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map(mapHeader);
  const rows: ImportClientRow[] = [];

  for (const line of lines.slice(1)) {
    const values = splitCsvLine(line);
    const row: Partial<ImportClientRow> = {};

    headers.forEach((field, index) => {
      if (!field) return;
      const value = values[index]?.trim();
      if (!value) return;
      row[field] = value;
    });

    if (!row.name || !row.document) continue;
    rows.push(row as ImportClientRow);
  }

  return rows;
}
