import { describe, it, expect } from 'vitest';
import {
  createClientSchema,
  updateClientSchema,
  blockClientSchema,
  listClientsQuerySchema,
} from '../src/modules/clients/clients.schema';

describe('clients.schema', () => {
  describe('createClientSchema', () => {
    it('accepts valid minimal input', () => {
      const result = createClientSchema.parse({ name: 'Jo' });
      expect(result.name).toBe('Jo');
      expect(result.type).toBe('INDIVIDUAL');
    });

    it('accepts valid COMPANY type', () => {
      const result = createClientSchema.parse({ name: 'Empresa LTDA', type: 'COMPANY' });
      expect(result.type).toBe('COMPANY');
    });

    it('rejects name shorter than 2 chars', () => {
      expect(() => createClientSchema.parse({ name: 'X' })).toThrow();
    });

    it('rejects invalid email', () => {
      expect(() =>
        createClientSchema.parse({ name: 'Joao', email: 'not-an-email' }),
      ).toThrow();
    });

    it('rejects document shorter than 11 chars', () => {
      expect(() =>
        createClientSchema.parse({ name: 'Joao', document: '12345' }),
      ).toThrow();
    });

    it('accepts address object', () => {
      const result = createClientSchema.parse({
        name: 'Joao Silva',
        address: { city: 'Sao Paulo', state: 'SP' },
      });
      expect(result.address?.city).toBe('Sao Paulo');
    });
  });

  describe('updateClientSchema', () => {
    it('accepts partial fields', () => {
      const result = updateClientSchema.parse({ name: 'Novo Nome' });
      expect(result.name).toBe('Novo Nome');
    });

    it('accepts empty object', () => {
      const result = updateClientSchema.parse({});
      expect(result).toEqual({});
    });
  });

  describe('blockClientSchema', () => {
    it('accepts valid reason', () => {
      const result = blockClientSchema.parse({ reason: 'Inadimplente' });
      expect(result.reason).toBe('Inadimplente');
    });

    it('rejects reason shorter than 3 chars', () => {
      expect(() => blockClientSchema.parse({ reason: 'ok' })).toThrow();
    });

    it('rejects missing reason', () => {
      expect(() => blockClientSchema.parse({})).toThrow();
    });
  });

  describe('listClientsQuerySchema', () => {
    it('applies defaults when no params provided', () => {
      const result = listClientsQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.isBlocked).toBeUndefined();
    });

    it('transforms isBlocked string true to boolean', () => {
      const result = listClientsQuerySchema.parse({ isBlocked: 'true' });
      expect(result.isBlocked).toBe(true);
    });

    it('transforms isBlocked string false to boolean', () => {
      const result = listClientsQuerySchema.parse({ isBlocked: 'false' });
      expect(result.isBlocked).toBe(false);
    });

    it('leaves isBlocked undefined for unknown values', () => {
      const result = listClientsQuerySchema.parse({ isBlocked: 'unknown' });
      expect(result.isBlocked).toBeUndefined();
    });

    it('caps limit at 100', () => {
      const result = listClientsQuerySchema.parse({ limit: '999' });
      expect(result.limit).toBe(100);
    });

    it('coerces page and limit from strings', () => {
      const result = listClientsQuerySchema.parse({ page: '3', limit: '50' });
      expect(result.page).toBe(3);
      expect(result.limit).toBe(50);
    });
  });
});
