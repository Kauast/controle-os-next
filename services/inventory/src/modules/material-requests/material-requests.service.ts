import { prisma } from '../../lib/prisma';
import { NotFoundError, ConflictError } from '../../lib/errors';
import { parsePagination, buildPaginatedResult } from '../../lib/pagination';
import { publish } from '../../lib/publisher';
import type {
  CreateMaterialRequestInput,
  ReviewMaterialRequestInput,
  ListMaterialRequestsQuery,
} from './material-requests.schema';

export class MaterialRequestsService {
  async list(companyId: string, query: ListMaterialRequestsQuery) {
    const { page, limit, skip } = parsePagination(query);

    const where: Record<string, unknown> = { companyId };
    if (query.serviceOrderId) where.serviceOrderId = query.serviceOrderId;
    if (query.productId) where.productId = query.productId;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      prisma.materialRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { id: true, name: true, unit: true } } },
      }),
      prisma.materialRequest.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async create(companyId: string, input: CreateMaterialRequestInput) {
    const product = await prisma.product.findFirst({
      where: { id: input.productId, companyId, deletedAt: null, isActive: true },
    });
    if (!product) throw new NotFoundError('Produto');

    return prisma.materialRequest.create({
      data: {
        companyId,
        serviceOrderId: input.serviceOrderId,
        productId: input.productId,
        quantity: input.quantity,
        note: input.note,
        status: 'PENDING',
      },
      include: { product: { select: { id: true, name: true, unit: true } } },
    });
  }

  async review(
    companyId: string,
    requestId: string,
    reviewerId: string,
    input: ReviewMaterialRequestInput,
  ) {
    const request = await prisma.materialRequest.findFirst({
      where: { id: requestId, companyId },
    });
    if (!request) throw new NotFoundError('Solicitacao de material');

    if (request.status !== 'PENDING') {
      throw new ConflictError(`Solicitacao ja foi ${request.status === 'APPROVED' ? 'aprovada' : 'rejeitada'}`);
    }

    const updated = await prisma.materialRequest.update({
      where: { id: requestId },
      data: {
        status: input.status,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
      include: { product: { select: { id: true, name: true, unit: true } } },
    });

    await publish('material_request.reviewed', {
      companyId,
      requestId,
      serviceOrderId: request.serviceOrderId,
      productId: request.productId,
      quantity: request.quantity,
      status: input.status,
      reviewedBy: reviewerId,
      timestamp: new Date().toISOString(),
    });

    return updated;
  }
}
