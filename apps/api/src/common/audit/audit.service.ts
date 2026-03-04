import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AuditRecord = {
  actorUserId: string;
  action: string;
  objectType: string;
  objectId: string;
  beforeJson?: Record<string, unknown> | null;
  afterJson?: Record<string, unknown> | null;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly records: AuditRecord[] = [];
  constructor(private readonly prisma: PrismaService) {}

  async log(record: AuditRecord): Promise<void> {
    this.records.unshift(record);
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: record.actorUserId,
          action: record.action,
          objectType: record.objectType,
          objectId: record.objectId,
          beforeJson: (record.beforeJson as Prisma.InputJsonValue | null | undefined) ?? undefined,
          afterJson: (record.afterJson as Prisma.InputJsonValue | null | undefined) ?? undefined,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to persist audit log: ${String(error)}`);
    }
    this.logger.log(
      JSON.stringify({
        ...record,
        ts: new Date().toISOString(),
      }),
    );
  }

  async list(limit: number): Promise<AuditRecord[]> {
    try {
      const rows = await this.prisma.auditLog.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      });

      return rows.map((row) => ({
        actorUserId: row.actorUserId ?? 'unknown',
        action: row.action,
        objectType: row.objectType,
        objectId: row.objectId,
        beforeJson: (row.beforeJson as Record<string, unknown> | null) ?? null,
        afterJson: (row.afterJson as Record<string, unknown> | null) ?? null,
      }));
    } catch {
      return this.records.slice(0, limit);
    }
  }
}
