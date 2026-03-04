import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { RequestUser } from '../../common/auth/request-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAction } from '../../common/decorators/require-action.decorator';
import { RequireIdempotency } from '../../common/decorators/require-idempotency.decorator';
import type {
  CreateTournamentDto,
  GenerateBracketDto,
  ListTournamentsQueryDto,
  RegisterTournamentDto,
} from './tournaments.dto';
import { TournamentsService } from './tournaments.service';

@Controller()
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Get('tournaments')
  @RequireAction('tournament.view')
  list(@Query() query: ListTournamentsQueryDto) {
    return this.tournamentsService.list(query);
  }

  @Get('tournaments/:id')
  @RequireAction('tournament.view')
  getById(@Param('id') id: string) {
    return this.tournamentsService.getById(id);
  }

  @Post('vendor/tournaments')
  @RequireAction('tournament.create')
  @RequireIdempotency()
  create(
    @CurrentUser() user: RequestUser,
    @Body() body: CreateTournamentDto,
  ) {
    return this.tournamentsService.create(user, body);
  }

  @Post('tournaments/:id/register')
  @RequireAction('tournament.register')
  @RequireIdempotency()
  register(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: RegisterTournamentDto,
  ) {
    return this.tournamentsService.register(user, id, body);
  }

  @Post('vendor/tournaments/:id/generate-bracket')
  @RequireAction('tournament.bracket.generate')
  @RequireIdempotency()
  generateBracket(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: GenerateBracketDto,
  ) {
    return this.tournamentsService.generateBracket(user, id, body);
  }
}
