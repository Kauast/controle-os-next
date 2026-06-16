import { describe, it, expect } from 'vitest';
import { parsePagination, buildPaginatedResult } from '../src/lib/pagination';

describe('pagination', () => {
  describe('parsePagination', () => {
    it('returns defaults when no params', () => {
      const r = parsePagination({});
      expect(r.page).toBe(1);
      expect(r.limit).toBe(20);
      expect(r.skip).toBe(0);
    });

    it('calculates skip correctly', () => {
      const r = parsePagination({ page: 3, limit: 10 });
      expect(r.skip).toBe(20);
    });

    it('enforces maxLimit', () => {
      const r = parsePagination({ limit: 999 }, 50);
      expect(r.limit).toBe(50);
    });

    it('enforces minimum page of 1', () => {
      const r = parsePagination({ page: -5 });
      expect(r.page).toBe(1);
    });
  });

  describe('buildPaginatedResult', () => {
    it('computes hasNext and hasPrev correctly', () => {
      const r = buildPaginatedResult([1, 2], 50, 2, 10);
      expect(r.hasPrev).toBe(true);
      expect(r.hasNext).toBe(true);
      expect(r.totalPages).toBe(5);
    });

    it('hasNext is false on last page', () => {
      const r = buildPaginatedResult([1], 10, 2, 10);
      expect(r.hasNext).toBe(false);
    });

    it('hasPrev is false on first page', () => {
      const r = buildPaginatedResult([1], 10, 1, 10);
      expect(r.hasPrev).toBe(false);
    });
  });
});
