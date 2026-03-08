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
    const autoApprove = this.shouldAutoApproveVendor();
    const existing = await this.prisma.vendor.findFirst({
      where: {
        ownerUserId,
        status: {
          in: [VendorStatus.PENDING_APPROVAL, VendorStatus.APPROVED],
        },
      },
      select: {
        id: true,
        status: true,
        businessName: true,
      },
    });

    if (existing) {
      if (autoApprove && existing.status !== VendorStatus.APPROVED) {
        const approved = await this.prisma.vendor.update({
          where: { id: existing.id },
          data: {
            status: VendorStatus.APPROVED,
            approvedAt: new Date(),
          },
          select: {
            id: true,
            status: true,
            businessName: true,
          },
        });
        await this.prisma.user.update({
          where: { id: ownerUserId },
          data: {
            role: 'VENDOR_OWNER',
          },
        });
        return approved;
      }
      return existing;
    }

    const vendor = await this.prisma.vendor.create({
      data: {
        ownerUserId,
        businessName: dto.businessName,
        status: autoApprove ? VendorStatus.APPROVED : VendorStatus.PENDING_APPROVAL,
        approvedAt: autoApprove ? new Date() : null,
      },
      select: {
        id: true,
        status: true,
        businessName: true,
      },
    });

    if (vendor.status === VendorStatus.APPROVED) {
      await this.prisma.user.update({
        where: { id: ownerUserId },
        data: {
          role: 'VENDOR_OWNER',
        },
      });
    }

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

  private shouldAutoApproveVendor(): boolean {
    return process.env.OTP_PROVIDER === 'stub' || process.env.VENDOR_AUTO_APPROVE === 'true';
  }
}
