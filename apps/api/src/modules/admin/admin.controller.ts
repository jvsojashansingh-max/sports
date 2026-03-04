import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAction } from '../../common/decorators/require-action.decorator';
import { RequireIdempotency } from '../../common/decorators/require-idempotency.decorator';
import type { RequestUser } from '../../common/auth/request-user';
import { AuditService } from '../../common/audit/audit.service';
import { SimulateAuditDto } from './admin.dto';

@Controller('admin/audit')
export class AdminController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequireAction('vendor.approval.review')
  async list(@Query('limit') limit = '50') {
    return {
      rows: await this.auditService.list(Number.parseInt(limit, 10) || 50),
    };
  }

  @Post('simulate')
  @RequireAction('vendor.approval.review')
  @RequireIdempotency()
  async simulate(@CurrentUser() user: RequestUser, @Body() body: SimulateAuditDto) {
    await this.auditService.log({
      actorUserId: user.id,
      action: body.action ?? 'admin.audit.simulate',
      objectType: body.objectType,
      objectId: body.objectId,
      beforeJson: null,
      afterJson: {
        simulated: true,
      },
    });

    return { ok: true };
  }
}
