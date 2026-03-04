import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestUser } from '../../common/auth/request-user';
import type { CreateFormatDto, ListFormatsQueryDto } from './formats.dto';

@Injectable()
export class FormatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createVendorFormat(user: RequestUser, dto: CreateFormatDto) {
    const vendorId = await this.mustGetVendorId(user.id);

    const created = await this.prisma.format.create({
      data: {
        vendorId,
        sportId: dto.sportId,
        name: dto.name,
        teamSize: dto.teamSize,
        durationMinutes: dto.durationMinutes,
        rulesText: dto.rulesText,
        refereeAllowed: dto.refereeAllowed,
        refereeFeeDisplay: dto.refereeFeeDisplay,
        joinDeadlineMinutes: dto.joinDeadlineMinutes,
        checkinOpenMinutes: dto.checkinOpenMinutes,
        noShowGraceMinutes: dto.noShowGraceMinutes,
      },
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'format.create',
      objectType: 'format',
      objectId: created.id,
      beforeJson: null,
      afterJson: {
        sportId: created.sportId,
        name: created.name,
      },
    });

    return created;
  }

  async listFormats(query: ListFormatsQueryDto) {
    let vendorId: string | null = null;
    if (query.venueId) {
      const venue = await this.prisma.venue.findUnique({
        where: { id: query.venueId },
        select: { vendorId: true },
      });
      vendorId = venue?.vendorId ?? null;
    }

    return this.prisma.format.findMany({
      where: {
        deletedAt: null,
        enabled: true,
        ...(query.sportId ? { sportId: query.sportId } : {}),
        ...(vendorId
          ? {
              OR: [{ vendorId }, { vendorId: null }],
            }
          : {}),
      },
      orderBy: [{ vendorId: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  private async mustGetVendorId(ownerUserId: string): Promise<string> {
    const vendor = await this.prisma.vendor.findFirst({
      where: {
        ownerUserId,
        status: 'APPROVED',
      },
      select: { id: true },
    });
    if (!vendor) {
      throw new ForbiddenException('FORBIDDEN');
    }
    return vendor.id;
  }
}
