import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { VendorStatus } from '@prisma/client';
import type { RequestUser } from '../../common/auth/request-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAction } from '../../common/decorators/require-action.decorator';
import { RequireIdempotency } from '../../common/decorators/require-idempotency.decorator';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';

class UpdateVendorStatusDto {
  reason?: string;
}

@Controller('admin/vendors')
export class AdminVendorsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequireAction('vendor.approval.review')
  list(@Query('status') status = 'PENDING_APPROVAL') {
    const parsed = parseVendorStatus(status);
    return this.prisma.vendor.findMany({
      where: {
        status: parsed,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        ownerUserId: true,
        status: true,
        businessName: true,
        approvedAt: true,
        createdAt: true,
      },
    });
  }

  @Post(':vendorId/approve')
  @RequireAction('vendor.approval.review')
  @RequireIdempotency()
  async approve(
    @CurrentUser() admin: RequestUser,
    @Param('vendorId') vendorId: string,
    @Body() _body: UpdateVendorStatusDto,
  ) {
    const before = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    const updated = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        status: VendorStatus.APPROVED,
        approvedAt: new Date(),
      },
    });
    await this.prisma.user.update({
      where: { id: updated.ownerUserId },
      data: { role: 'VENDOR_OWNER' },
    });

    await this.audit.log({
      actorUserId: admin.id,
      action: 'vendor.approve',
      objectType: 'vendor',
      objectId: vendorId,
      beforeJson: before,
      afterJson: updated,
    });

    return {
      id: updated.id,
      status: updated.status,
      approvedAt: updated.approvedAt,
    };
  }

  @Post(':vendorId/reject')
  @RequireAction('vendor.approval.review')
  @RequireIdempotency()
  async reject(
    @CurrentUser() admin: RequestUser,
    @Param('vendorId') vendorId: string,
    @Body() body: UpdateVendorStatusDto,
  ) {
    const before = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    const updated = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        status: VendorStatus.REJECTED,
      },
    });
    const otherApproved = await this.prisma.vendor.count({
      where: {
        ownerUserId: updated.ownerUserId,
        status: VendorStatus.APPROVED,
        id: { not: updated.id },
      },
    });
    if (otherApproved === 0) {
      await this.prisma.user.update({
        where: { id: updated.ownerUserId },
        data: { role: 'PLAYER' },
      });
    }

    await this.audit.log({
      actorUserId: admin.id,
      action: 'vendor.reject',
      objectType: 'vendor',
      objectId: vendorId,
      beforeJson: before,
      afterJson: {
        ...updated,
        reason: body.reason ?? null,
      },
    });

    return {
      id: updated.id,
      status: updated.status,
    };
  }
}

function parseVendorStatus(value: string): VendorStatus {
  switch (value) {
    case 'APPROVED':
      return VendorStatus.APPROVED;
    case 'REJECTED':
      return VendorStatus.REJECTED;
    case 'SUSPENDED':
      return VendorStatus.SUSPENDED;
    default:
      return VendorStatus.PENDING_APPROVAL;
  }
}
