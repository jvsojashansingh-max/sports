import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { RequestUser } from '../../common/auth/request-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAction } from '../../common/decorators/require-action.decorator';
import { RequireIdempotency } from '../../common/decorators/require-idempotency.decorator';
import type { MarkPaymentStatusDto, MatchCheckinDto, MatchForfeitDto } from './matches.dto';
import { MatchesService } from './matches.service';
import { DisputeStatus } from '@prisma/client';
import type { ListDisputesQueryDto, ResolveDisputeDto, SubmitResultDto } from './matches.dto';

@Controller('vendor/matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post(':id/checkin')
  @RequireAction('match.checkin.manage')
  checkin(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() body: MatchCheckinDto) {
    return this.matchesService.checkin(user, id, body);
  }

  @Post(':id/forfeit')
  @RequireAction('match.forfeit.manage')
  forfeit(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() body: MatchForfeitDto) {
    return this.matchesService.forfeit(user, id, body);
  }

  @Post(':id/mark-payment-status')
  @RequireAction('payment.status.mark')
  markPaymentStatus(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: MarkPaymentStatusDto,
  ) {
    return this.matchesService.markPaymentStatus(user, id, body);
  }

  @Post(':id/resolve-dispute')
  @RequireAction('match.dispute.resolve')
  resolveDispute(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: ResolveDisputeDto,
  ) {
    return this.matchesService.resolveDispute(user, id, body);
  }
}

@Controller()
export class PlayerMatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post('matches/:id/submit-result')
  @RequireAction('match.result.submit')
  @RequireIdempotency()
  submitResult(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: SubmitResultDto,
  ) {
    return this.matchesService.submitResult(user, id, body);
  }
}

@Controller('admin/disputes')
export class AdminDisputesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  @RequireAction('dispute.admin.review')
  list(@Query() query: ListDisputesQueryDto) {
    return this.matchesService.listDisputes(query.status);
  }

  @Post(':id/resolve')
  @RequireAction('dispute.admin.review')
  resolve(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: ResolveDisputeDto,
  ) {
    return this.matchesService.adminResolveDispute(user, id, body, DisputeStatus.RESOLVED);
  }

  @Post(':id/escalate')
  @RequireAction('dispute.admin.review')
  escalate(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: ResolveDisputeDto,
  ) {
    return this.matchesService.adminResolveDispute(user, id, body, DisputeStatus.ESCALATED);
  }
}
