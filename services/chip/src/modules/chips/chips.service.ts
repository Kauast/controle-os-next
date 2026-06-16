import { ChipStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { publish } from '../../lib/publisher';
import { NotFoundError, ConflictError, BusinessError } from '../../lib/errors';
import { parsePagination, buildPaginatedResult } from '../../lib/pagination';
import type {
  CreateChipInput,
  UpdateChipInput,
  AssignChipInput,
  InstallChipInput,
  ListChipsQuery,
} from './chips.schema';

export interface RequestUser {
  id: string;
  companyId: string;
  name?: string;
  role?: string;
}

export class ChipService {
  // ── List ──────────────────────────────────────────────────────────────────

  async list(query: ListChipsQuery, companyId: string) {
    const { page, limit, skip } = parsePagination(query);

    const where = {
      companyId,
      deletedAt: null,
      ...(query.status ? { status: query.status as ChipStatus } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.operator
        ? { operator: { contains: query.operator, mode: 'insensitive' as const } }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.chip.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.chip.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  // ── Find by ID ────────────────────────────────────────────────────────────

  async findById(id: string, companyId: string) {
    const chip = await prisma.chip.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!chip) throw new NotFoundError('Chip');
    return chip;
  }

  // ── History ───────────────────────────────────────────────────────────────

  async findHistory(id: string, companyId: string) {
    const chip = await prisma.chip.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!chip) throw new NotFoundError('Chip');

    return prisma.chipHistory.findMany({
      where: { chipId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(data: CreateChipInput, user: RequestUser) {
    const existing = await prisma.chip.findFirst({
      where: { companyId: user.companyId, iccid: data.iccid, deletedAt: null },
    });
    if (existing) throw new ConflictError('ICCID ja cadastrado nesta empresa');

    const chip = await prisma.chip.create({
      data: {
        companyId: user.companyId,
        iccid: data.iccid,
        number: data.number,
        operator: data.operator,
        status: ChipStatus.AVAILABLE,
      },
    });

    await this.addHistory(chip.id, 'CHIP_CREATED', user, 'Chip criado com ICCID ' + chip.iccid);

    await publish('chip.created', {
      chipId: chip.id,
      companyId: chip.companyId,
      iccid: chip.iccid,
      number: chip.number,
      operator: chip.operator,
      status: chip.status,
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    return chip;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(id: string, data: UpdateChipInput, user: RequestUser) {
    const chip = await prisma.chip.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
    });
    if (!chip) throw new NotFoundError('Chip');

    if (data.iccid && data.iccid !== chip.iccid) {
      const conflict = await prisma.chip.findFirst({
        where: {
          companyId: user.companyId,
          iccid: data.iccid,
          deletedAt: null,
          NOT: { id },
        },
      });
      if (conflict) throw new ConflictError('ICCID ja utilizado por outro chip');
    }

    const updated = await prisma.chip.update({
      where: { id },
      data: {
        ...(data.iccid ? { iccid: data.iccid } : {}),
        ...(data.number !== undefined ? { number: data.number } : {}),
        ...(data.operator !== undefined ? { operator: data.operator } : {}),
      },
    });

    await this.addHistory(id, 'CHIP_UPDATED', user);
    return updated;
  }

  // ── Soft Delete ───────────────────────────────────────────────────────────

  async delete(id: string, user: RequestUser) {
    const chip = await prisma.chip.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
    });
    if (!chip) throw new NotFoundError('Chip');

    await prisma.chip.update({
      where: { id },
      data: { deletedAt: new Date(), status: ChipStatus.INACTIVE },
    });

    await this.addHistory(id, 'CHIP_DELETED', user, 'Chip ' + chip.iccid + ' removido');

    await publish('chip.deleted', {
      chipId: id,
      companyId: user.companyId,
      iccid: chip.iccid,
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  }

  // ── Assign ────────────────────────────────────────────────────────────────

  async assign(id: string, data: AssignChipInput, user: RequestUser) {
    const chip = await prisma.chip.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
    });
    if (!chip) throw new NotFoundError('Chip');

    if (chip.status === ChipStatus.INSTALLED) {
      throw new BusinessError(
        'Chip ja instalado. Faca release antes de reatribuir.',
        'CHIP_INSTALLED',
      );
    }
    if (chip.status === ChipStatus.INACTIVE) {
      throw new BusinessError('Chip inativo nao pode ser atribuido.', 'CHIP_INACTIVE');
    }

    const updated = await prisma.chip.update({
      where: { id },
      data: {
        status: ChipStatus.ASSIGNED,
        clientId: data.clientId,
        clientName: data.clientName,
        assignedAt: new Date(),
        serviceOrderId: null,
      },
    });

    await this.addHistory(id, 'CHIP_ASSIGNED', user, 'Atribuido ao cliente ' + data.clientName);

    await publish('chip.assigned', {
      chipId: id,
      companyId: user.companyId,
      clientId: data.clientId,
      clientName: data.clientName,
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    return updated;
  }

  // ── Install ───────────────────────────────────────────────────────────────

  async install(id: string, data: InstallChipInput, user: RequestUser) {
    const chip = await prisma.chip.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
    });
    if (!chip) throw new NotFoundError('Chip');

    if (chip.status === ChipStatus.INACTIVE) {
      throw new BusinessError('Chip inativo nao pode ser instalado.', 'CHIP_INACTIVE');
    }

    const updated = await prisma.chip.update({
      where: { id },
      data: {
        status: ChipStatus.INSTALLED,
        serviceOrderId: data.serviceOrderId,
        installedAt: new Date(),
      },
    });

    await this.addHistory(id, 'CHIP_INSTALLED', user, 'Instalado na OS ' + data.serviceOrderId);

    await publish('chip.installed', {
      chipId: id,
      companyId: user.companyId,
      serviceOrderId: data.serviceOrderId,
      clientId: chip.clientId,
      installedAt: updated.installedAt?.toISOString(),
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    return updated;
  }

  // ── Release ───────────────────────────────────────────────────────────────

  async release(id: string, user: RequestUser) {
    const chip = await prisma.chip.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
    });
    if (!chip) throw new NotFoundError('Chip');

    if (chip.status === ChipStatus.AVAILABLE) {
      throw new BusinessError('Chip ja esta disponivel.', 'CHIP_ALREADY_AVAILABLE');
    }

    const updated = await prisma.chip.update({
      where: { id },
      data: {
        status: ChipStatus.AVAILABLE,
        clientId: null,
        clientName: null,
        serviceOrderId: null,
        assignedAt: null,
        installedAt: null,
      },
    });

    await this.addHistory(id, 'CHIP_RELEASED', user, 'Chip liberado e disponibilizado');

    await publish('chip.released', {
      chipId: id,
      companyId: user.companyId,
      previousClientId: chip.clientId,
      previousServiceOrderId: chip.serviceOrderId,
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    return updated;
  }

  // ── Consumer handlers ─────────────────────────────────────────────────────

  async installByOs(
    serviceOrderId: string,
    companyId: string,
    chipIccid: string,
    userId?: string,
    userName?: string,
  ): Promise<void> {
    const chip = await prisma.chip.findFirst({
      where: { companyId, iccid: chipIccid, deletedAt: null },
    });
    if (!chip) return;

    await prisma.chip.update({
      where: { id: chip.id },
      data: { status: ChipStatus.INSTALLED, serviceOrderId, installedAt: new Date() },
    });

    const user: RequestUser = { id: userId ?? 'system', companyId, name: userName ?? 'Sistema' };
    await this.addHistory(
      chip.id,
      'CHIP_INSTALLED_OS',
      user,
      'Instalado automaticamente via OS ' + serviceOrderId,
    );
  }

  async releaseByClient(
    clientId: string,
    companyId: string,
    userId?: string,
    userName?: string,
  ): Promise<void> {
    const chips = await prisma.chip.findMany({
      where: { clientId, companyId, deletedAt: null },
    });
    if (chips.length === 0) return;

    await prisma.chip.updateMany({
      where: { clientId, companyId, deletedAt: null },
      data: {
        status: ChipStatus.AVAILABLE,
        clientId: null,
        clientName: null,
        serviceOrderId: null,
        assignedAt: null,
        installedAt: null,
      },
    });

    const user: RequestUser = { id: userId ?? 'system', companyId, name: userName ?? 'Sistema' };
    await Promise.all(
      chips.map((chip) =>
        this.addHistory(
          chip.id,
          'CHIP_RELEASED_CLIENT_DELETED',
          user,
          'Cliente ' + clientId + ' excluido - chip liberado',
        ),
      ),
    );
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async addHistory(
    chipId: string,
    action: string,
    user: RequestUser,
    note?: string,
  ): Promise<void> {
    await prisma.chipHistory.create({
      data: {
        chipId,
        action,
        note,
        userId: user.id,
        userName: user.name ?? user.id,
      },
    });
  }
}
