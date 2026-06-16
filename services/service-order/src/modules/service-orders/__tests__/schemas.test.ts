import { describe, it, expect } from 'vitest';
import {
  createServiceOrderSchema,
  updateStatusSchema,
  assignSchema,
  updateExecutionSchema,
  listQuerySchema,
} from '../service-orders.schema';

describe('createServiceOrderSchema', () => {
  const valid = {
    clientId:    'client-123',
    clientName:  'João Silva',
    description: 'Instalação de câmera',
    priority:    'HIGH' as const,
    items: [
      { type: 'SERVICE' as const, description: 'Mão de obra', quantity: 1, unitPrice: 150 },
    ],
  };

  it('aceita payload válido', () => {
    const result = createServiceOrderSchema.parse(valid);
    expect(result.clientId).toBe('client-123');
    expect(result.priority).toBe('HIGH');
    expect(result.items).toHaveLength(1);
  });

  it('usa MEDIUM como priority padrão', () => {
    const { priority: _, ...rest } = valid;
    const result = createServiceOrderSchema.parse(rest);
    expect(result.priority).toBe('MEDIUM');
  });

  it('rejeita clientId vazio', () => {
    expect(() => createServiceOrderSchema.parse({ ...valid, clientId: '' })).toThrow();
  });

  it('rejeita item com quantity negativa', () => {
    expect(() =>
      createServiceOrderSchema.parse({
        ...valid,
        items: [{ ...valid.items[0], quantity: -1 }],
      }),
    ).toThrow();
  });

  it('aceita items vazio por padrão', () => {
    const { items: _, ...rest } = valid;
    const result = createServiceOrderSchema.parse(rest);
    expect(result.items).toEqual([]);
  });
});

describe('updateStatusSchema', () => {
  it('aceita cancelamento com motivo', () => {
    const result = updateStatusSchema.parse({ status: 'CANCELLED', cancelReason: 'Cliente desistiu' });
    expect(result.status).toBe('CANCELLED');
  });

  it('rejeita cancelamento sem cancelReason', () => {
    expect(() => updateStatusSchema.parse({ status: 'CANCELLED' })).toThrow();
  });

  it('aceita OPEN sem cancelReason', () => {
    const result = updateStatusSchema.parse({ status: 'OPEN' });
    expect(result.status).toBe('OPEN');
  });

  it('rejeita status inválido', () => {
    expect(() => updateStatusSchema.parse({ status: 'INVALID_STATUS' })).toThrow();
  });
});

describe('assignSchema', () => {
  it('aceita technicianId e technicianName', () => {
    const result = assignSchema.parse({ technicianId: 'tech-1', technicianName: 'Carlos' });
    expect(result.technicianId).toBe('tech-1');
    expect(result.technicianName).toBe('Carlos');
  });

  it('rejeita technicianId vazio', () => {
    expect(() => assignSchema.parse({ technicianId: '', technicianName: 'Carlos' })).toThrow();
  });
});

describe('updateExecutionSchema', () => {
  it('aceita checkin completo', () => {
    const result = updateExecutionSchema.parse({
      technicianId: 'tech-1',
      checkinAt:    '2024-01-01T10:00:00.000Z',
      checkinLat:   -23.5505,
      checkinLng:   -46.6333,
    });
    expect(result.technicianId).toBe('tech-1');
  });

  it('aceita payload mínimo', () => {
    const result = updateExecutionSchema.parse({ technicianId: 'tech-1' });
    expect(result.technicianId).toBe('tech-1');
  });

  it('rejeita signatureUrl inválida', () => {
    expect(() =>
      updateExecutionSchema.parse({
        technicianId: 'tech-1',
        signatureUrl: 'not-a-url',
      }),
    ).toThrow();
  });
});

describe('listQuerySchema', () => {
  it('parseia page e limit como número', () => {
    const result = listQuerySchema.parse({ page: '2', limit: '10' });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
  });

  it('rejeita limit acima de 100', () => {
    expect(() => listQuerySchema.parse({ limit: '200' })).toThrow();
  });

  it('aceita query vazia', () => {
    const result = listQuerySchema.parse({});
    expect(result.status).toBeUndefined();
  });

  it('aceita status válido', () => {
    const result = listQuerySchema.parse({ status: 'IN_PROGRESS' });
    expect(result.status).toBe('IN_PROGRESS');
  });
});
