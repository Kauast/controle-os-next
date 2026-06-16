import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { parsePagination, buildPaginatedResult, type PaginatedResult } from '../../lib/pagination';
import type { ListNotificationsQuery } from './notifications.schema';

export interface NotificationRow {
  id:         string;
  companyId:  string;
  channel:    NotificationChannel;
  status:     NotificationStatus;
  recipient:  string;
  subject:    string | null;
  sentAt:     Date | null;
  errorMsg:   string | null;
  retryCount: number;
  createdAt:  Date;
  updatedAt:  Date;
}

export async function listNotifications(
  companyId: string,
  query: ListNotificationsQuery,
): Promise<PaginatedResult<NotificationRow>> {
  const { page, limit, skip } = parsePagination({ page: query.page, limit: query.limit });

  const where = {
    companyId,
    ...(query.channel ? { channel: query.channel as NotificationChannel } : {}),
    ...(query.status  ? { status:  query.status  as NotificationStatus  } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id:         true,
        companyId:  true,
        channel:    true,
        status:     true,
        recipient:  true,
        subject:    true,
        sentAt:     true,
        errorMsg:   true,
        retryCount: true,
        createdAt:  true,
        updatedAt:  true,
      },
    }),
    prisma.notification.count({ where }),
  ]);

  return buildPaginatedResult(data, total, page, limit);
}
