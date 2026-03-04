import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, BookingType, Prisma } from '@prisma/client';
import type { RequestUser } from '../../common/auth/request-user';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ACTIVE_BOOKING_STATUSES } from './booking.state';
import type { CreateBookingHoldDto, ListMyBookingsQueryDto } from './bookings.dto';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createHold(user: RequestUser, dto: CreateBookingHoldDto) {
    const startTs = new Date(dto.startTs);
    const endTs = new Date(dto.endTs);

    if (!isFinite(startTs.getTime()) || !isFinite(endTs.getTime()) || startTs >= endTs) {
      throw new BadRequestException('VALIDATION_ERROR');
    }

    const resource = await this.prisma.resource.findFirst({
      where: {
        id: dto.resourceId,
        deletedAt: null,
        status: 'ACTIVE',
        venue: {
          deletedAt: null,
          status: 'LIVE',
          vendor: {
            status: 'APPROVED',
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (!resource) {
      throw new NotFoundException('NOT_FOUND');
    }

    try {
      const created = await this.prisma.booking.create({
        data: {
          resourceId: dto.resourceId,
          startTs,
          endTs,
          type: dto.type ?? BookingType.CHALLENGE,
          status: BookingStatus.HELD,
          createdByUserId: user.id,
          holdExpiresAt: new Date(Date.now() + 3 * 60 * 1000),
        },
      });

      await this.audit.log({
        actorUserId: user.id,
        action: 'booking.hold.create',
        objectType: 'booking',
        objectId: created.id,
        beforeJson: null,
        afterJson: {
          status: created.status,
          resourceId: created.resourceId,
          startTs: created.startTs.toISOString(),
          endTs: created.endTs.toISOString(),
        },
      });

      return created;
    } catch (error) {
      if (isOverlapConstraintError(error)) {
        throw new ConflictException('CONFLICT');
      }
      throw error;
    }
  }

  async moveToWaitingOpponent(user: RequestUser, bookingId: string) {
    const existing = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        createdByUserId: user.id,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException('NOT_FOUND');
    }

    if (existing.status !== BookingStatus.HELD) {
      throw new ConflictException('CONFLICT');
    }

    if (existing.holdExpiresAt && existing.holdExpiresAt < new Date()) {
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CANCELLED,
        },
      });
      throw new ConflictException('CONFLICT');
    }

    const updated = await this.prisma.booking.update({
      where: {
        id: bookingId,
      },
      data: {
        status: BookingStatus.WAITING_OPPONENT,
        holdExpiresAt: null,
      },
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'booking.hold.activate',
      objectType: 'booking',
      objectId: bookingId,
      beforeJson: {
        status: existing.status,
      },
      afterJson: {
        status: updated.status,
      },
    });

    return updated;
  }

  async listMine(user: RequestUser, query: ListMyBookingsQueryDto) {
    if (!user.id) {
      throw new ForbiddenException('FORBIDDEN');
    }

    return this.prisma.booking.findMany({
      where: {
        createdByUserId: user.id,
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: {
        startTs: 'asc',
      },
      take: 100,
    });
  }

  async expireHeldBookings(now = new Date()) {
    const result = await this.prisma.booking.updateMany({
      where: {
        status: BookingStatus.HELD,
        holdExpiresAt: {
          lt: now,
        },
      },
      data: {
        status: BookingStatus.CANCELLED,
      },
    });

    return result.count;
  }

  async listBookedRangesForResources(resourceIds: string[], dayStart: Date, dayEnd: Date) {
    if (resourceIds.length === 0) {
      return [];
    }

    return this.prisma.booking.findMany({
      where: {
        resourceId: {
          in: resourceIds,
        },
        status: {
          in: ACTIVE_BOOKING_STATUSES,
        },
        startTs: {
          lt: dayEnd,
        },
        endTs: {
          gt: dayStart,
        },
        deletedAt: null,
      },
      select: {
        resourceId: true,
        startTs: true,
        endTs: true,
      },
    });
  }
}

function isOverlapConstraintError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2004') {
      return true;
    }
  }
  return false;
}
