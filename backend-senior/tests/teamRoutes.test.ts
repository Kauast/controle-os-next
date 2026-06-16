import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    team: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '../src/lib/prisma';

const mockTeams = [
  {
    id: 'team-1',
    name: 'Equipe Alpha',
    active: true,
    members: [
      { technician: { id: 'tech-1', name: 'João Silva', status: 'AVAILABLE' } },
      { technician: { id: 'tech-2', name: 'Pedro Costa', status: 'BUSY' } },
    ],
  },
];

describe('GET /api/teams', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna equipes com membros formatados', async () => {
    vi.mocked(prisma.team.findMany).mockResolvedValue(mockTeams as any);

    const { listTeams } = await import('../src/routes/teamRoutes');
    const result = await listTeams('company-1');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Equipe Alpha');
    expect(result[0].members).toHaveLength(2);
    expect(result[0].members[0].name).toBe('João Silva');
    expect(result[0].online).toBe(true);
  });
});
