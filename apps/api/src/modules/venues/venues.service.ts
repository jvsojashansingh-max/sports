import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ResourceStatus, SportId, VendorStatus, VenueStatus } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type {
  CreateResourceDto,
  CreateVenueDto,
  UpdateResourceDto,
  UpdateVenueDto,
} from './venues.dto';

@Injectable()
export class VenuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listPlayerVenues(params: {
    cityId?: string;
    sportId?: SportId;
    q?: string;
  }) {
    const where: Prisma.VenueWhereInput = {
      deletedAt: null,
      status: VenueStatus.LIVE,
      vendor: {
        status: VendorStatus.APPROVED,
      },
    };

    if (params.cityId) {
      where.cityId = params.cityId;
    }

    if (params.q?.trim()) {
      where.OR = [
        { name: { contains: params.q.trim(), mode: 'insensitive' } },
        { address: { contains: params.q.trim(), mode: 'insensitive' } },
      ];
    }

    if (params.sportId) {
      where.resources = {
        some: {
          sportId: params.sportId,
          status: ResourceStatus.ACTIVE,
          deletedAt: null,
        },
      };
    }

    return this.prisma.venue.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        cityId: true,
        stateId: true,
        address: true,
        status: true,
        resources: {
          where: {
            deletedAt: null,
            status: ResourceStatus.ACTIVE,
          },
          select: {
            sportId: true,
          },
        },
      },
      take: 100,
    });
  }

  async getPlayerVenue(venueId: string) {
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
          select: {
            id: true,
            sportId: true,
            name: true,
            capacity: true,
            status: true,
          },
        },
      },
    });

    if (!venue) {
      throw new NotFoundException('NOT_FOUND');
    }

    return venue;
  }

  async listVendorVenues(ownerUserId: string) {
    const vendor = await this.mustGetApprovedVendor(ownerUserId);

    return this.prisma.venue.findMany({
      where: {
        vendorId: vendor.id,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createVenue(ownerUserId: string, dto: CreateVenueDto) {
    const vendor = await this.mustGetApprovedVendor(ownerUserId);
    const status = this.shouldAutoPublishVenue() ? VenueStatus.LIVE : VenueStatus.DRAFT;

    const venue = await this.prisma.venue.create({
      data: {
        vendorId: vendor.id,
        name: dto.name,
        cityId: dto.cityId,
        stateId: dto.stateId,
        address: dto.address,
        lat: dto.lat,
        lng: dto.lng,
        photos: (dto.photos as Prisma.InputJsonValue | undefined) ?? undefined,
        paymentInstructions: dto.paymentInstructions,
        paymentMode: dto.paymentMode,
        vendorPaymentLink: dto.vendorPaymentLink,
        status,
      },
    });

    await this.audit.log({
      actorUserId: ownerUserId,
      action: 'venue.create',
      objectType: 'venue',
      objectId: venue.id,
      beforeJson: null,
      afterJson: {
        venueId: venue.id,
        vendorId: vendor.id,
        status: venue.status,
      },
    });

    return venue;
  }

  async updateVenue(ownerUserId: string, venueId: string, dto: UpdateVenueDto) {
    const vendor = await this.mustGetApprovedVendor(ownerUserId);
    const existing = await this.prisma.venue.findFirst({
      where: {
        id: venueId,
        vendorId: vendor.id,
        deletedAt: null,
      },
    });
    if (!existing) {
      throw new NotFoundException('NOT_FOUND');
    }

    const updated = await this.prisma.venue.update({
      where: { id: venueId },
      data: {
        name: dto.name,
        address: dto.address,
        status: dto.status,
        paymentInstructions: dto.paymentInstructions,
        paymentMode: dto.paymentMode,
        vendorPaymentLink: dto.vendorPaymentLink,
      },
    });

    await this.audit.log({
      actorUserId: ownerUserId,
      action: 'venue.update',
      objectType: 'venue',
      objectId: venueId,
      beforeJson: {
        status: existing.status,
        name: existing.name,
      },
      afterJson: {
        status: updated.status,
        name: updated.name,
      },
    });

    return updated;
  }

  async listVendorResources(ownerUserId: string, venueId?: string) {
    const vendor = await this.mustGetApprovedVendor(ownerUserId);

    return this.prisma.resource.findMany({
      where: {
        deletedAt: null,
        ...(venueId ? { venueId } : {}),
        venue: {
          vendorId: vendor.id,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createResource(ownerUserId: string, dto: CreateResourceDto) {
    const vendor = await this.mustGetApprovedVendor(ownerUserId);
    const venue = await this.prisma.venue.findFirst({
      where: {
        id: dto.venueId,
        vendorId: vendor.id,
        deletedAt: null,
      },
    });
    if (!venue) {
      throw new ForbiddenException('FORBIDDEN');
    }

    const resource = await this.prisma.resource.create({
      data: {
        venueId: dto.venueId,
        sportId: dto.sportId,
        name: dto.name,
        capacity: dto.capacity,
      },
    });

    if (this.shouldAutoSeedAvailabilityTemplates()) {
      await this.prisma.availabilityTemplate.createMany({
        data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
          resourceId: resource.id,
          dayOfWeek,
          startMinute: 6 * 60,
          endMinute: 22 * 60,
          slotMinutes: 60,
          bufferMinutes: 0,
        })),
      });
    }

    await this.audit.log({
      actorUserId: ownerUserId,
      action: 'resource.create',
      objectType: 'resource',
      objectId: resource.id,
      beforeJson: null,
      afterJson: {
        venueId: resource.venueId,
        sportId: resource.sportId,
        seededDefaultAvailability: this.shouldAutoSeedAvailabilityTemplates(),
      },
    });

    return resource;
  }

  async updateResource(ownerUserId: string, resourceId: string, dto: UpdateResourceDto) {
    const vendor = await this.mustGetApprovedVendor(ownerUserId);
    const existing = await this.prisma.resource.findFirst({
      where: {
        id: resourceId,
        venue: {
          vendorId: vendor.id,
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('NOT_FOUND');
    }

    const updated = await this.prisma.resource.update({
      where: { id: resourceId },
      data: {
        name: dto.name,
        capacity: dto.capacity,
        status: dto.status,
      },
    });

    await this.audit.log({
      actorUserId: ownerUserId,
      action: 'resource.update',
      objectType: 'resource',
      objectId: resourceId,
      beforeJson: {
        name: existing.name,
        status: existing.status,
      },
      afterJson: {
        name: updated.name,
        status: updated.status,
      },
    });

    return updated;
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

  private shouldAutoPublishVenue(): boolean {
    return process.env.OTP_PROVIDER === 'stub' || process.env.VENDOR_AUTO_APPROVE === 'true';
  }

  private shouldAutoSeedAvailabilityTemplates(): boolean {
    return process.env.OTP_PROVIDER === 'stub' || process.env.VENDOR_AUTO_APPROVE === 'true';
  }
}
