import { Prisma } from '../lib/prisma';

type TransactionWithQuery = {
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Promise<T>;
};

export async function lockTenantSequence(
  tx: TransactionWithQuery,
  companyId: string,
  scope: string,
) {
  const lockKey = `${scope}:${companyId}`;

  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
  `;
}
