import { describe, it, expect } from 'vitest';
import { canTransition, OrderStatusType } from '../service-orders.schema';

describe('canTransition — máquina de estados', () => {
  // Transições válidas
  it('PENDING_RESERVATION → OPEN', () => {
    expect(canTransition('PENDING_RESERVATION', 'OPEN')).toBe(true);
  });

  it('PENDING_RESERVATION → CANCELLED', () => {
    expect(canTransition('PENDING_RESERVATION', 'CANCELLED')).toBe(true);
  });

  it('OPEN → ASSIGNED', () => {
    expect(canTransition('OPEN', 'ASSIGNED')).toBe(true);
  });

  it('OPEN → IN_PROGRESS', () => {
    expect(canTransition('OPEN', 'IN_PROGRESS')).toBe(true);
  });

  it('OPEN → CANCELLED', () => {
    expect(canTransition('OPEN', 'CANCELLED')).toBe(true);
  });

  it('OPEN → WAITING_PARTS', () => {
    expect(canTransition('OPEN', 'WAITING_PARTS')).toBe(true);
  });

  it('ASSIGNED → IN_PROGRESS', () => {
    expect(canTransition('ASSIGNED', 'IN_PROGRESS')).toBe(true);
  });

  it('ASSIGNED → OPEN (reatribuição)', () => {
    expect(canTransition('ASSIGNED', 'OPEN')).toBe(true);
  });

  it('ASSIGNED → CANCELLED', () => {
    expect(canTransition('ASSIGNED', 'CANCELLED')).toBe(true);
  });

  it('IN_PROGRESS → COMPLETED', () => {
    expect(canTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
  });

  it('IN_PROGRESS → CANCELLED', () => {
    expect(canTransition('IN_PROGRESS', 'CANCELLED')).toBe(true);
  });

  it('IN_PROGRESS → WAITING_PARTS', () => {
    expect(canTransition('IN_PROGRESS', 'WAITING_PARTS')).toBe(true);
  });

  it('WAITING_PARTS → IN_PROGRESS', () => {
    expect(canTransition('WAITING_PARTS', 'IN_PROGRESS')).toBe(true);
  });

  it('WAITING_PARTS → CANCELLED', () => {
    expect(canTransition('WAITING_PARTS', 'CANCELLED')).toBe(true);
  });

  // Estados terminais
  it('COMPLETED é terminal — não aceita nenhuma transição', () => {
    const all: OrderStatusType[] = [
      'PENDING_RESERVATION', 'OPEN', 'ASSIGNED', 'IN_PROGRESS',
      'COMPLETED', 'CANCELLED', 'WAITING_PARTS',
    ];
    for (const to of all) {
      expect(canTransition('COMPLETED', to)).toBe(false);
    }
  });

  it('CANCELLED é terminal — não aceita nenhuma transição', () => {
    const all: OrderStatusType[] = [
      'PENDING_RESERVATION', 'OPEN', 'ASSIGNED', 'IN_PROGRESS',
      'COMPLETED', 'CANCELLED', 'WAITING_PARTS',
    ];
    for (const to of all) {
      expect(canTransition('CANCELLED', to)).toBe(false);
    }
  });

  // Transições inválidas explícitas
  it('OPEN não pode ir para PENDING_RESERVATION', () => {
    expect(canTransition('OPEN', 'PENDING_RESERVATION')).toBe(false);
  });

  it('IN_PROGRESS não pode ir para OPEN diretamente', () => {
    expect(canTransition('IN_PROGRESS', 'OPEN')).toBe(false);
  });

  it('PENDING_RESERVATION não pode ir para IN_PROGRESS', () => {
    expect(canTransition('PENDING_RESERVATION', 'IN_PROGRESS')).toBe(false);
  });
});
