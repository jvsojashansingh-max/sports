import { ConflictException, Injectable } from '@nestjs/common';
import { VendorStatus } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RegisterVendorDto } from './vendors.dto';

@Injectable()
export class VendorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async register(ownerUserId: string, dto: RegisterVendorDto) {
    const existing = await this.prisma.vendor.findFirst({
      where: {
        ownerUserId,
        status: {
          in: [VendorStatus.PENDING_APPROVAL, VendorStatus.APPROVED],
        },
      },
    });

    if (existing) {
      throw new ConflictException('CONFLICT: vendor already exists for owner');
    }

    const vendor = await this.prisma.vendor.create({
      data: {
        ownerUserId,
        businessName: dto.businessName,
      },
      select: {
        id: true,
        status: true,
        businessName: true,
      },
    });

    await this.auditService.log({
      actorUserId: ownerUserId,
      action: 'vendor.register',
      objectType: 'vendor',
      objectId: vendor.id,
      beforeJson: null,
      afterJson: {
        status: vendor.status,
        businessName: vendor.businessName,
      },
    });

    return vendor;
  }
}
