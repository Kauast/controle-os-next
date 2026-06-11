import { describe, it, expect } from 'vitest';
import { triageInputSchema, triageResultSchema } from '../src/services/aiService';

// Testes de regressão das fronteiras de entrada/saída da triagem por IA.
// Não tocam a API externa — validam apenas os contratos de dados.
describe('triageInputSchema', () => {
  it('aceita descrição válida', () => {
    const r = triageInputSchema.safeParse({ description: 'Rastreador parou de enviar sinal desde ontem.' });
    expect(r.success).toBe(true);
  });

  it('rejeita descrição muito curta', () => {
    const r = triageInputSchema.safeParse({ description: 'parou' });
    expect(r.success).toBe(false);
  });

  it('rejeita descrição acima do limite', () => {
    const r = triageInputSchema.safeParse({ description: 'x'.repeat(4001) });
    expect(r.success).toBe(false);
  });
});

describe('triageResultSchema', () => {
  it('aceita resultado bem formado', () => {
    const r = triageResultSchema.safeParse({
      summary: 'Rastreador sem sinal.',
      suggestedPriority: 'HIGH',
      suggestedTeam: 'Suporte Remoto',
      reasoning: 'Veículo sem rastreamento representa risco.',
    });
    expect(r.success).toBe(true);
  });

  it('rejeita prioridade fora do enum (proteção contra resposta inválida da IA)', () => {
    const r = triageResultSchema.safeParse({
      summary: 'x',
      suggestedPriority: 'URGENTE',
      suggestedTeam: 'x',
      reasoning: 'x',
    });
    expect(r.success).toBe(false);
  });
});
