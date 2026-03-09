import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/auth/request-user';
import { RequireIdempotency } from '../../common/decorators/require-idempotency.decorator';
import { UsersService } from './users.service';
import { UpdateMeDto } from './users.dto';

@Controller('me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  me(@CurrentUser() user: RequestUser) {
    return this.usersService.getMe(user.id);
  }

  @Get('activity')
  activity(@CurrentUser() user: RequestUser) {
    return this.usersService.getActivity(user.id);
  }

  @Patch()
  @RequireIdempotency()
  update(@CurrentUser() user: RequestUser, @Body() body: UpdateMeDto) {
    return this.usersService.updateMe(user.id, body);
  }
}
