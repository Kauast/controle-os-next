import { describe, it, expect } from 'vitest';
import { canTransition, createOSSchema, updateExecutionSchema } from '../src/lib/serviceOrderRules';

// Regra 8: testes de regressão do fluxo crítico — máquina de estados da OS.
// Qualquer alteração indevida nas transições quebra estes testes.
describe('canTransition — máquina de estados da OS', () => {
  it('permite transições válidas a partir de OPEN', () => {
    expect(canTransition('OPEN', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('OPEN', 'CANCELLED')).toBe(true);
  });

  it('permite transições válidas a partir de IN_PROGRESS', () => {
    expect(canTransition('IN_PROGRESS', 'WAITING_PARTS')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'CANCELLED')).toBe(true);
  });

  it('permite retomar de WAITING_PARTS', () => {
    expect(canTransition('WAITING_PARTS', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('WAITING_PARTS', 'CANCELLED')).toBe(true);
  });

  it('NÃO permite pular OPEN direto para COMPLETED', () => {
    expect(canTransition('OPEN', 'COMPLETED')).toBe(false);
  });

  it('NÃO permite concluir direto de WAITING_PARTS', () => {
    expect(canTransition('WAITING_PARTS', 'COMPLETED')).toBe(false);
  });

  it('estados terminais não permitem nenhuma transição', () => {
    for (const to of ['OPEN', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'CANCELLED'] as const) {
      expect(canTransition('COMPLETED', to)).toBe(false);
      expect(canTransition('CANCELLED', to)).toBe(false);
    }
  });
});

describe('createOSSchema — validação de criação de OS', () => {
  const base = {
    clientId: 'clx123',
    dueDate: new Date().toISOString(),
    items: [],
  };

  it('aceita payload mínimo válido', () => {
    const r = createOSSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it('rejeita clientId vazio', () => {
    const r = createOSSchema.safeParse({ ...base, clientId: '' });
    expect(r.success).toBe(false);
  });

  it('rejeita item com quantidade não positiva', () => {
    const r = createOSSchema.safeParse({
      ...base,
      items: [{ description: 'x', quantity: 0, unitPrice: 10, itemType: 'SERVICE' }],
    });
    expect(r.success).toBe(false);
  });

  it('rejeita item com preço negativo', () => {
    const r = createOSSchema.safeParse({
      ...base,
      items: [{ description: 'x', quantity: 1, unitPrice: -5, itemType: 'SERVICE' }],
    });
    expect(r.success).toBe(false);
  });

  it('rejeita scheduledTime em formato inválido', () => {
    const r = createOSSchema.safeParse({ ...base, scheduledTime: '9h' });
    expect(r.success).toBe(false);
  });
});

describe('updateExecutionSchema — validação de execução', () => {
  it('aceita datas ISO válidas', () => {
    const r = updateExecutionSchema.safeParse({ checkinAt: new Date().toISOString() });
    expect(r.success).toBe(true);
  });

  it('rejeita checkinAt fora do formato datetime', () => {
    const r = updateExecutionSchema.safeParse({ checkinAt: '2026-13-40' });
    expect(r.success).toBe(false);
  });
});
