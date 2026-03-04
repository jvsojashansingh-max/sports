import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ResourceStatus, VendorStatus, VenueStatus } from '@prisma/client';
import type {
  AvailabilityQueryDto,
  CreateAvailabilityTemplateDto,
  CreateBlockDto,
  ListBlocksQueryDto,
  UpdateAvailabilityTemplateDto,
} from './availability.dto';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buildSlotsForDay } from './availability.slots';
import { BookingsService } from '../bookings/bookings.service';

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly bookingsService: BookingsService,
  ) {}

  async createTemplate(ownerUserId: string, dto: CreateAvailabilityTemplateDto) {
    validateTemplateWindow(dto.startMinute, dto.endMinute, dto.slotMinutes);
    const vendor = await this.mustGetApprovedVendor(ownerUserId);
    await this.assertVendorOwnsResource(vendor.id, dto.resourceId);

    const created = await this.prisma.availabilityTemplate.create({
      data: {
        resourceId: dto.resourceId,
        dayOfWeek: dto.dayOfWeek,
        startMinute: dto.startMinute,
        endMinute: dto.endMinute,
        slotMinutes: dto.slotMinutes,
        bufferMinutes: dto.bufferMinutes,
      },
    });

    await this.audit.log({
      actorUserId: ownerUserId,
      action: 'availability.template.create',
      objectType: 'availability_template',
      objectId: created.id,
      beforeJson: null,
      afterJson: {
        resourceId: created.resourceId,
        dayOfWeek: created.dayOfWeek,
      },
    });

    return created;
  }

  async listTemplates(ownerUserId: string, resourceId?: string) {
    const vendor = await this.mustGetApprovedVendor(ownerUserId);

    if (resourceId) {
      await this.assertVendorOwnsResource(vendor.id, resourceId);
    }

    return this.prisma.availabilityTemplate.findMany({
      where: {
        deletedAt: null,
        ...(resourceId ? { resourceId } : {}),
        resource: {
          venue: {
            vendorId: vendor.id,
          },
        },
      },
      orderBy: [{ resourceId: 'asc' }, { dayOfWeek: 'asc' }, { startMinute: 'asc' }],
    });
  }

  async updateTemplate(
    ownerUserId: string,
    templateId: string,
    dto: UpdateAvailabilityTemplateDto,
  ) {
    const vendor = await this.mustGetApprovedVendor(ownerUserId);

    const existing = await this.prisma.availabilityTemplate.findFirst({
      where: {
        id: templateId,
        deletedAt: null,
        resource: {
          venue: {
            vendorId: vendor.id,
          },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('NOT_FOUND');
    }

    const startMinute = dto.startMinute ?? existing.startMinute;
    const endMinute = dto.endMinute ?? existing.endMinute;
    const slotMinutes = dto.slotMinutes ?? existing.slotMinutes;
    validateTemplateWindow(startMinute, endMinute, slotMinutes);

    const updated = await this.prisma.availabilityTemplate.update({
      where: { id: templateId },
      data: {
        dayOfWeek: dto.dayOfWeek,
        startMinute: dto.startMinute,
        endMinute: dto.endMinute,
        slotMinutes: dto.slotMinutes,
        bufferMinutes: dto.bufferMinutes,
      },
    });

    await this.audit.log({
      actorUserId: ownerUserId,
      action: 'availability.template.update',
      objectType: 'availability_template',
      objectId: templateId,
      beforeJson: {
        dayOfWeek: existing.dayOfWeek,
        startMinute: existing.startMinute,
        endMinute: existing.endMinute,
      },
      afterJson: {
        dayOfWeek: updated.dayOfWeek,
        startMinute: updated.startMinute,
        endMinute: updated.endMinute,
      },
    });

    return updated;
  }

  async deleteTemplate(ownerUserId: string, templateId: string) {
    const vendor = await this.mustGetApprovedVendor(ownerUserId);
    const existing = await this.prisma.availabilityTemplate.findFirst({
      where: {
        id: templateId,
        deletedAt: null,
        resource: {
          venue: {
            vendorId: vendor.id,
          },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('NOT_FOUND');
    }

    await this.prisma.availabilityTemplate.update({
      where: { id: templateId },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      actorUserId: ownerUserId,
      action: 'availability.template.delete',
      objectType: 'availability_template',
      objectId: templateId,
      beforeJson: { deletedAt: null },
      afterJson: { deletedAt: 'set' },
    });

    return { ok: true };
  }

  async createBlock(ownerUserId: string, dto: CreateBlockDto) {
    const vendor = await this.mustGetApprovedVendor(ownerUserId);
    await this.assertVendorOwnsResource(vendor.id, dto.resourceId);

    const startTs = new Date(dto.startTs);
    const endTs = new Date(dto.endTs);
    if (!(startTs < endTs)) {
      throw new BadRequestException('VALIDATION_ERROR');
    }

    const created = await this.prisma.block.create({
      data: {
        resourceId: dto.resourceId,
        startTs,
        endTs,
        reason: dto.reason,
        createdByUserId: ownerUserId,
      },
    });

    await this.audit.log({
      actorUserId: ownerUserId,
      action: 'block.create',
      objectType: 'block',
      objectId: created.id,
      beforeJson: null,
      afterJson: {
        resourceId: created.resourceId,
        startTs: created.startTs.toISOString(),
        endTs: created.endTs.toISOString(),
      },
    });

    return created;
  }

  async listBlocks(ownerUserId: string, query: ListBlocksQueryDto) {
    const vendor = await this.mustGetApprovedVendor(ownerUserId);
    if (query.resourceId) {
      await this.assertVendorOwnsResource(vendor.id, query.resourceId);
    }

    const from = query.fromTs ? new Date(query.fromTs) : null;
    const to = query.toTs ? new Date(query.toTs) : null;

    return this.prisma.block.findMany({
      where: {
        deletedAt: null,
        ...(query.resourceId ? { resourceId: query.resourceId } : {}),
        ...(from ? { endTs: { gt: from } } : {}),
        ...(to ? { startTs: { lt: to } } : {}),
        resource: {
          venue: {
            vendorId: vendor.id,
          },
        },
      },
      orderBy: [{ startTs: 'asc' }],
    });
  }

  async deleteBlock(ownerUserId: string, blockId: string) {
    const vendor = await this.mustGetApprovedVendor(ownerUserId);
    const existing = await this.prisma.block.findFirst({
      where: {
        id: blockId,
        deletedAt: null,
        resource: {
          venue: {
            vendorId: vendor.id,
          },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('NOT_FOUND');
    }

    await this.prisma.block.update({
      where: { id: blockId },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      actorUserId: ownerUserId,
      action: 'block.delete',
      objectType: 'block',
      objectId: blockId,
      beforeJson: { deletedAt: null },
      afterJson: { deletedAt: 'set' },
    });

    return { ok: true };
  }

  async venueAvailability(venueId: string, query: AvailabilityQueryDto) {
    const dayStart = parseDayStartUtc(query.date);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const dayOfWeek = dayStart.getUTCDay();

    const venue = await this.prisma.venue.findFirst({
      where: {
        id: venueId,
        deletedAt: null,
        status: VenueStatus.LIVE,
        vendor: {
          status: VendorStatus.APPROVED,
        },
      },
      include: {
        resources: {
          where: {
            deletedAt: null,
            status: ResourceStatus.ACTIVE,
          },
        },
      },
    });
    if (!venue) {
      throw new NotFoundException('NOT_FOUND');
    }

    const resourceIds = venue.resources.map((resource) => resource.id);

    const [templates, blocks, bookings] = await Promise.all([
      this.prisma.availabilityTemplate.findMany({
        where: {
          deletedAt: null,
          resourceId: { in: resourceIds },
          dayOfWeek,
        },
      }),
      this.prisma.block.findMany({
        where: {
          deletedAt: null,
          resourceId: { in: resourceIds },
          startTs: { lt: dayEnd },
          endTs: { gt: dayStart },
        },
      }),
      this.bookingsService.listBookedRangesForResources(resourceIds, dayStart, dayEnd),
    ]);

    const templateByResource = new Map<string, typeof templates>();
    for (const template of templates) {
      const current = templateByResource.get(template.resourceId) ?? [];
      current.push(template);
      templateByResource.set(template.resourceId, current);
    }

    const blocksByResource = new Map<string, typeof blocks>();
    for (const block of blocks) {
      const current = blocksByResource.get(block.resourceId) ?? [];
      current.push(block);
      blocksByResource.set(block.resourceId, current);
    }

    const bookingsByResource = new Map<string, typeof bookings>();
    for (const booking of bookings) {
      const current = bookingsByResource.get(booking.resourceId) ?? [];
      current.push(booking);
      bookingsByResource.set(booking.resourceId, current);
    }

    return {
      resources: venue.resources.map((resource) => {
        const slots = buildSlotsForDay({
          dayStartUtc: dayStart,
          templates: (templateByResource.get(resource.id) ?? []).map((template) => ({
            startMinute: template.startMinute,
            endMinute: template.endMinute,
            slotMinutes: template.slotMinutes,
            bufferMinutes: template.bufferMinutes,
          })),
          blockedRanges: (blocksByResource.get(resource.id) ?? []).map((block) => ({
            startTs: block.startTs,
            endTs: block.endTs,
          })),
          bookedRanges: (bookingsByResource.get(resource.id) ?? []).map((booking) => ({
            startTs: booking.startTs,
            endTs: booking.endTs,
          })),
        });

        return {
          resourceId: resource.id,
          slots,
        };
      }),
    };
  }

  private async mustGetApprovedVendor(ownerUserId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: {
        ownerUserId,
        status: VendorStatus.APPROVED,
      },
    });

    if (!vendor) {
      throw new ForbiddenException('FORBIDDEN');
    }

    return vendor;
  }

  private async assertVendorOwnsResource(vendorId: string, resourceId: string): Promise<void> {
    const resource = await this.prisma.resource.findFirst({
      where: {
        id: resourceId,
        deletedAt: null,
        venue: {
          vendorId,
        },
      },
    });

    if (!resource) {
      throw new ForbiddenException('FORBIDDEN');
    }
  }
}

function parseDayStartUtc(raw: string): Date {
  const plainDate = raw.includes('T') ? raw.slice(0, 10) : raw;
  const parsed = new Date(`${plainDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('VALIDATION_ERROR');
  }
  return parsed;
}

function validateTemplateWindow(startMinute: number, endMinute: number, slotMinutes: number) {
  if (startMinute >= endMinute) {
    throw new BadRequestException('VALIDATION_ERROR');
  }
  if (endMinute - startMinute < slotMinutes) {
    throw new BadRequestException('VALIDATION_ERROR');
  }
}
