import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { RequestUser } from '../../common/auth/request-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAction } from '../../common/decorators/require-action.decorator';
import { RequireIdempotency } from '../../common/decorators/require-idempotency.decorator';
import { ChallengesService } from './challenges.service';
import {
  CreateChallengeDto,
  InviteTeamMemberDto,
  LobbyChallengesQueryDto,
  RemoveTeamMemberDto,
} from './challenges.dto';

@Controller()
export class ChallengesController {
  constructor(private readonly challengesService: ChallengesService) {}

  @Post('challenges')
  @RequireAction('challenge.create')
  @RequireIdempotency()
  create(@CurrentUser() user: RequestUser, @Body() body: CreateChallengeDto) {
    return this.challengesService.create(user, body);
  }

  @Get('vendor/challenges')
  @RequireAction('vendor.venue.manage')
  listVendorChallenges(@CurrentUser() user: RequestUser) {
    return this.challengesService.listManagedChallenges(user);
  }

  @Get('challenges/:id')
  @RequireAction('challenge.view')
  getById(@Param('id') id: string) {
    return this.challengesService.getById(id);
  }

  @Post('challenges/:id/accept')
  @RequireAction('challenge.accept')
  @RequireIdempotency()
  accept(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.challengesService.accept(user, id);
  }

  @Post('challenges/:id/confirm-opponent')
  @RequireAction('challenge.confirm')
  @RequireIdempotency()
  confirmOpponent(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.challengesService.confirmOpponent(user, id);
  }

  @Post('teams/:teamId/invite')
  @RequireAction('team.invite')
  @RequireIdempotency()
  inviteToTeam(
    @CurrentUser() user: RequestUser,
    @Param('teamId') teamId: string,
    @Body() body: InviteTeamMemberDto,
  ) {
    return this.challengesService.inviteToTeam(user, teamId, body);
  }

  @Post('teams/:teamId/remove')
  @RequireAction('team.remove')
  @RequireIdempotency()
  removeFromTeam(
    @CurrentUser() user: RequestUser,
    @Param('teamId') teamId: string,
    @Body() body: RemoveTeamMemberDto,
  ) {
    return this.challengesService.removeFromTeam(user, teamId, body);
  }

  @Post('teams/:teamId/join')
  @RequireAction('team.join')
  @RequireIdempotency()
  joinTeam(@CurrentUser() user: RequestUser, @Param('teamId') teamId: string) {
    return this.challengesService.joinTeam(user, teamId);
  }

  @Get('lobby/challenges')
  lobby(@Query() query: LobbyChallengesQueryDto) {
    return this.challengesService.lobby(query);
  }
}
