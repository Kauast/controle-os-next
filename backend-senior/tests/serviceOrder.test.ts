import { describe, it, expect } from 'vitest';
import { canTransition } from '../src/lib/serviceOrderRules';
import { OrderStatus } from '@prisma/client';

describe('canTransition', () => {
  it('permite OPEN → IN_PROGRESS', () => {
    expect(canTransition(OrderStatus.OPEN, OrderStatus.IN_PROGRESS)).toBe(true);
  });

  it('permite OPEN → CANCELLED', () => {
    expect(canTransition(OrderStatus.OPEN, OrderStatus.CANCELLED)).toBe(true);
  });

  it('bloqueia OPEN → COMPLETED (salto inválido)', () => {
    expect(canTransition(OrderStatus.OPEN, OrderStatus.COMPLETED)).toBe(false);
  });

  it('bloqueia COMPLETED → qualquer estado', () => {
    const targets: OrderStatus[] = [OrderStatus.OPEN, OrderStatus.IN_PROGRESS, OrderStatus.WAITING_PARTS, OrderStatus.CANCELLED];
    targets.forEach((t) => expect(canTransition(OrderStatus.COMPLETED, t)).toBe(false));
  });

  it('bloqueia CANCELLED → qualquer estado', () => {
    const targets: OrderStatus[] = [OrderStatus.OPEN, OrderStatus.IN_PROGRESS, OrderStatus.COMPLETED];
    targets.forEach((t) => expect(canTransition(OrderStatus.CANCELLED, t)).toBe(false));
  });

  it('permite IN_PROGRESS → WAITING_PARTS', () => {
    expect(canTransition(OrderStatus.IN_PROGRESS, OrderStatus.WAITING_PARTS)).toBe(true);
  });

  it('permite WAITING_PARTS → IN_PROGRESS (retomada)', () => {
    expect(canTransition(OrderStatus.WAITING_PARTS, OrderStatus.IN_PROGRESS)).toBe(true);
  });
});
