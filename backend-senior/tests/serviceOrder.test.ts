import { describe, it, expect } from 'vitest';
import { canTransition } from '../src/lib/serviceOrderRules';
import { Status } from '@prisma/client';

describe('canTransition', () => {
  it('permite OPEN → IN_PROGRESS', () => {
    expect(canTransition(Status.OPEN, Status.IN_PROGRESS)).toBe(true);
  });

  it('permite OPEN → CANCELLED', () => {
    expect(canTransition(Status.OPEN, Status.CANCELLED)).toBe(true);
  });

  it('bloqueia OPEN → COMPLETED (salto inválido)', () => {
    expect(canTransition(Status.OPEN, Status.COMPLETED)).toBe(false);
  });

  it('bloqueia COMPLETED → qualquer estado', () => {
    const targets: Status[] = [Status.OPEN, Status.IN_PROGRESS, Status.WAITING_PARTS, Status.CANCELLED];
    targets.forEach((t) => expect(canTransition(Status.COMPLETED, t)).toBe(false));
  });

  it('bloqueia CANCELLED → qualquer estado', () => {
    const targets: Status[] = [Status.OPEN, Status.IN_PROGRESS, Status.COMPLETED];
    targets.forEach((t) => expect(canTransition(Status.CANCELLED, t)).toBe(false));
  });

  it('permite IN_PROGRESS → WAITING_PARTS', () => {
    expect(canTransition(Status.IN_PROGRESS, Status.WAITING_PARTS)).toBe(true);
  });

  it('permite WAITING_PARTS → IN_PROGRESS (retomada)', () => {
    expect(canTransition(Status.WAITING_PARTS, Status.IN_PROGRESS)).toBe(true);
  });
});
